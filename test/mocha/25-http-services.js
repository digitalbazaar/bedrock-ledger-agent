/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerNode = require('bedrock-ledger-node');
const brLedgerAgent = require('bedrock-ledger-agent');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const mockPlugin = require('./mock.plugin');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});

jsigs.use('jsonld', bedrock.jsonld);

// register a mock ledgerAgentPlugin
brLedgerNode.use('mock', mockPlugin);

describe('HTTP Services', () => {
  let signedConfig;
  let defaultLedgerAgent;
  let publicLedgerAgent;

  before(done => helpers.prepareDatabase(mockData, done));

  before(done => {
    let regularActor;
    async.auto({
      getRegularUser: callback => brIdentity.get(
        null, mockData.identities.regularUser.identity.id, (err, result) => {
          regularActor = result;
          callback(err);
        }),
      signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
        algorithm: 'RsaSignature2018',
        privateKeyPem:
          mockData.identities.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.identities.regularUser.keys.privateKey.publicKey
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
    const regularActor = mockData.identities.regularUser;
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
