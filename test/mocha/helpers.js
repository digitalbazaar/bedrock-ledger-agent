/*!
 * Copyright (c) 2016-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brKey = require('bedrock-key');
const {constants} = bedrock.config;
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures');

jsigs.use('jsonld', bedrock.jsonld);

const api = {};
module.exports = api;

api.createIdentity = userName => {
  const newIdentity = {
    id: userName,
    type: 'Identity',
    sysSlug: userName,
    label: userName,
    email: userName + '@bedrock.dev',
    sysPassword: 'password',
    sysPublic: ['label', 'url', 'description'],
    sysResourceRole: [],
    url: 'https://example.com',
    description: userName,
    sysStatus: 'active'
  };
  return newIdentity;
};

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
      '@context': constants.IDENTITY_CONTEXT_V1_URL,
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

api.removeCollection = (collection, callback) => {
  const collectionNames = [collection];
  database.openCollections(collectionNames, () => {
    async.each(collectionNames, (collectionName, callback) => {
      database.collections[collectionName].remove({}, callback);
    }, err => {
      callback(err);
    });
  });
};

api.removeCollections = callback => {
  const collectionNames = ['identity', 'eventLog'];
  database.openCollections(collectionNames, () => {
    async.each(collectionNames, (collectionName, callback) => {
      database.collections[collectionName].remove({}, callback);
    }, err => {
      callback(err);
    });
  });
};

api.prepareDatabase = (mockData, callback) => {
  async.series([
    callback => {
      api.removeCollections(callback);
    },
    callback => {
      insertTestData(mockData, callback);
    }
  ], callback);
};

api.getEventNumber = eventId =>
  Number(eventId.substring(eventId.lastIndexOf('/') + 1));

api.multiSign = (doc, signers, callback) => {
  if(!Array.isArray(signers)) {
    throw new TypeError('Signers must be an array.');
  }
  async.map(signers, (s, callback) => jsigs.sign(doc, {
    algorithm: 'RsaSignature2018',
    privateKeyPem: s.privateKeyPem,
    creator: s.creator
  }, callback), (err, results) => {
    if(err) {
      return callback(err);
    }
    const d = bedrock.util.clone(results[0]);
    d.proof = results.map(d => d.proof);
    callback(null, d);
  });
};

// Insert identities and public keys used for testing into database
function insertTestData(mockData, callback) {
  async.forEachOf(mockData.identities, (identity, key, callback) => {
    async.parallel([
      callback => brIdentity.insert(null, identity.identity, err => {
        if(err) {
          if(!(err.name === 'DuplicateError' ||
            database.isDuplicateError(err))) {
            // only pass on non-duplicate errors
            // duplicate error means test data is already loaded
            return callback(err);
          }
        }
        callback();
      }),
      callback => {
        if(identity.keys) {
          brKey.addPublicKey(null, identity.keys.publicKey, err => {
            if(err) {
              if(!(err.name === 'DuplicateError' ||
                database.isDuplicateError(err))) {
                // only pass on non-duplicate errors
                // duplicate error means test data is already loaded
                return callback(err);
              }
            }
            callback();
          });
        } else {
          callback();
        }
      }
    ], callback);
  }, callback, callback);
}
