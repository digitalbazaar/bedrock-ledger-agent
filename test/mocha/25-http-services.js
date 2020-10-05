/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const util = require('util');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const brLedgerAgent = require('bedrock-ledger-agent');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const mockPlugin = require('./mock.plugin');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});

const addLedgerAgentAsync = util.promisify(brLedgerAgent.add);

// register a mock ledgerAgentPlugin
try {
  brLedgerNode.use('mock', mockPlugin);
} catch(e) {
  // error means that plugin is already defined, ignore
}

describe('HTTP Services', () => {
  let signedConfig;
  let defaultLedgerAgent;
  // FIXME unused test data?
  // let publicLedgerAgent;

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });

  before(async function() {
    const regularActor = await brAccount.getCapabilities(
      {id: mockData.accounts.regularUser.account.id});
    signedConfig = await jsigs.sign(mockData.ledgerConfigurations.uni, {
      documentLoader,
      algorithm: 'RsaSignature2018',
      suite: mockData.accounts.regularUser.suite,
      purpose: mockData.purpose,
      privateKeyPem:
          mockData.accounts.regularUser.keys.privateKey.privateKeyPem,
      creator: mockData.accounts.regularUser.keys.privateKey.publicKey
    });
    const options = {
      ledgerConfiguration: signedConfig,
      owner: regularActor.id,
      // specify that the mock service
      plugins: ['mock'],
    };
    defaultLedgerAgent = await addLedgerAgentAsync(regularActor, null, options);
    /*
     * FIXME this was in the setup step, but is not used by any tests?
    const publicOptions = {
      ...options,
      public: true
    };
    publicLedgerAgent = await addLedgerAgentAsync(
      regularActor, null, publicOptions);
    */
  });
  beforeEach(async function() {
    await helpers.removeCollection('ledger_testLedger');
  });
  describe('plugins', () => {
    const regularActor = mockData.accounts.regularUser;
    it('should return an error on a request to unknown plugin', done => {
      const basePath = defaultLedgerAgent.service.ledgerAgentStatusService;
      async.auto({
        get: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: `${basePath}/plugins/unknown`,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            // bedrock-rest now returns 404
            res.statusCode.should.equal(404);
            callback();
          });
        }
      }, err => done(err));
    });
    // the plugin is valid, but the endpoint is not defined
    it('return error on invalid plugin endpoint', done => {
      const basePath = defaultLedgerAgent.service.ledgerAgentStatusService;
      async.auto({
        get: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: `${basePath}/plugins/mock/bar`,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(404);
            callback();
          });
        }
      }, err => done(err));
    });
    it('returns proper response from plugin', done => {
      async.auto({
        get: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service['urn:mock:foo-service'].id,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            should.exist(res.body);
            should.exist(res.body.success);
            res.body.success.should.be.true;
            callback();
          });
        }
      }, err => done(err));
    });
  });
});
