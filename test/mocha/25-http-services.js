/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
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

// register a mock ledgerAgentPlugin
try {
  brLedgerNode.use('mock', mockPlugin);
} catch(e) {
  // error means that plugin is already defined, ignore
}

describe.skip('HTTP Services', () => {
  let signedConfig;
  let defaultLedgerAgent;
  let publicLedgerAgent;

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });

  before(done => {
    let regularActor;
    async.auto({
      getRegularUser: callback => brAccount.getCapabilities(
        {id: mockData.accounts.regularUser.identity.id}, (err, result) => {
          regularActor = result;
          callback(err);
        }),
      signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
        documentLoader,
        algorithm: 'RsaSignature2018',
        privateKeyPem:
          mockData.accounts.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.accounts.regularUser.keys.privateKey.publicKey
      }, (err, result) => {
        signedConfig = result;
        callback(err);
      }),
      addDefault: ['getRegularUser', 'signConfig', (results, callback) => {
        const options = {
          ledgerConfiguration: signedConfig,
          owner: regularActor.id,
          // specify that the mock service
          plugins: ['mock'],
        };
        brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
          defaultLedgerAgent = ledgerAgent;
          callback(err);
        });
      }],
      addPublic: ['getRegularUser', 'signConfig', (results, callback) => {
        const options = {
          ledgerConfiguration: signedConfig,
          owner: regularActor.id,
          public: true
        };
        brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
          // eslint-disable-next-line no-unused-vars
          publicLedgerAgent = ledgerAgent;
          callback(err);
        });
      }]
    }, err => done(err));
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
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
            res.statusCode.should.equal(406);
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
            res.statusCode.should.equal(406);
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
