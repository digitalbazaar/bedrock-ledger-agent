/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const {promisify} = require('util');
const brAccount = require('bedrock-account');
const {RSAKeyPair} = require('crypto-ld');
const brLedgerNode = require('bedrock-ledger-node');
const {constants} = bedrock.config;
const database = require('bedrock-mongodb');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const jsigs = require('jsonld-signatures');
const brPassport = require('bedrock-passport');
const sinon = require('sinon');

const api = {};
module.exports = api;

api.stubs = {
  optionallyAuthenticated: sinon.stub(brPassport, 'optionallyAuthenticated'),
  authenticateAll: sinon.stub(brPassport, 'authenticateAll')
};

/**
 *  Stubs bedrock passport's authenticateAll with either a user object or false.
 *
 *  @param {object} options - Options to use.
 *  @param {object|boolean| [options.user = false] - A user object.
 *  @param {object} options.user.actor - The actor from getCapabilities.
 *  @param {object} options.user.account - An account object with an id.
 *
 *  @returns {object} An object with the stubs.
 */
api.stubPassport = ({user = false} = {}) => {
  const fakeAuth = (req, res, next) => {
    req.user = user;
    next();
  };
  api.stubs.optionallyAuthenticated.callsFake(fakeAuth);
  api.stubs.authenticateAll.returns({user});
  return api.stubs;
};

api.createAccount = ({userName, id}) => {
  const newAccount = {
    id: id || `urn:uuid:${bedrock.util.uuid()}`,
    email: userName + '@bedrock.dev',
  };
  return newAccount;
};

// used for new suites
api.ldKeyPair = ({publicKeyPem, privateKeyPem}) => new RSAKeyPair({
  publicKeyPem,
  privateKeyPem
});

api.createKeyPair = options => {
  const userName = options.userName;
  const publicKey = options.publicKey;
  const privateKey = options.privateKey;
  let ownerId = null;
  if(userName === 'userUnknown') {
    ownerId = '';
  } else {
    ownerId = options.userId;
  }
  const newKeyPair = {
    publicKey: {
      '@context': constants.SECURITY_CONTEXT_V1_URL,
      id: ownerId + '/keys/1',
      type: 'CryptographicKey',
      owner: ownerId,
      label: 'Signing Key 1',
      publicKeyPem: publicKey
    },
    privateKey: {
      type: 'CryptographicKey',
      owner: ownerId,
      label: 'Signing Key 1',
      publicKey: ownerId + '/keys/1',
      privateKeyPem: privateKey
    }
  };
  return newKeyPair;
};

api.createHttpSignatureRequest = options => {
  const newRequest = {
    url: options.url,
    httpSignature: {
      key: options.identity.keys.privateKey.privateKeyPem,
      keyId: options.identity.keys.publicKey.id,
      headers: ['date', 'host', 'request-line']
    }
  };
  if(options.body) {
    newRequest.body = options.body;
  }
  if(options.qs) {
    newRequest.qs = options.qs;
  }

  return newRequest;
};

api.removeCollection = async collection => {
  const collectionNames = [collection];
  return api.removeCollections(collectionNames);
};

api.removeCollections = async (collectionNames = ['identity', 'eventLog']) => {
  await promisify(database.openCollections)(collectionNames);
  for(const collectionName of collectionNames) {
    await database.collections[collectionName].deleteMany({});
  }
};

api.prepareDatabase = async mockData => {
  await api.removeCollections();
  await insertTestData(mockData);
};

api.getEventNumber = eventId =>
  Number(eventId.substring(eventId.lastIndexOf('/') + 1));

api.multiSign = (doc, signers, callback) => {
  if(!Array.isArray(signers)) {
    throw new TypeError('Signers must be an array.');
  }
  async.map(signers, (s, _callback) => jsigs.sign(doc, {
    documentLoader,
    algorithm: 'RsaSignature2018',
    suite: s.suite,
    purpose: s.purpose,
    privateKeyPem: s.privateKeyPem,
    creator: s.creator
  }).then(r => _callback(null, r)).catch(e => _callback(e)), (err, results) => {
    if(err) {
      return callback(err);
    }
    const d = bedrock.util.clone(results[0]);
    d.proof = results.flatMap(d => d.proof);
    callback(null, d);
  });
};

api.use = (plugin, callback) => {
  let p;
  try {
    p = brLedgerNode.use(plugin);
  } catch(e) {
    return callback(e);
  }
  callback(null, p);
};

// Insert accounts and public keys used for testing into database
async function insertTestData(mockData) {
  const accounts = Object.keys(mockData.accounts).map(async prop => {
    const user = mockData.accounts[prop];
    try {
      await brAccount.insert({
        actor: null,
        account: user.account,
        meta: user.meta});
      // FIXME check for keystore, create one, add keys here
    } catch(err) {
      if(!(err.name === 'DuplicateError' ||
        database.isDuplicateError(err))) {
        // only pass on non-duplicate errors
        // duplicate error means test data is already loaded
        throw err;
      }
    }
  });
  return Promise.all(accounts);
}
