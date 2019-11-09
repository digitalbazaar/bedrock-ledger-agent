/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const axios = require('axios');
const bedrock = require('bedrock');
const brHttpsAgent = require('bedrock-https-agent');
const brLedgerAgent = require('bedrock-ledger-agent');
const brLedgerNode = require('bedrock-ledger-node');
const cache = require('bedrock-redis');
const {config, util: {uuid}} = bedrock;
const {constants} = config;
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
const url = require('url');

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Continuity Integration Part II', () => {
  const regularActor = mockData.identities.regularUser;
  const nodes = 1;
  let ledgerAgent;
  let consensusApi;
  let genesisLedgerNode;
  const peers = [];

  before(done => async.series([
    callback => cache.client.flushall(callback),
    callback => helpers.prepareDatabase(mockData, callback)
  ], done));
  before(function(done) {
    this.timeout(60000);
    async.auto({
      consensusApi: callback =>
        helpers.use('Continuity2017', (err, result) => {
          consensusApi = result.api;
          callback(err);
        }),
      sign: callback => {
        jsigs.sign(mockData.ledgerConfigurations.continuity, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
          creator: regularActor.keys.publicKey.id
        }, callback);
      },
      add: ['sign', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {ledgerConfiguration: results.sign, public: true},
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        });
      }],
      get: ['add', (results, callback) => {
        request.get(helpers.createHttpSignatureRequest({
          url: results.add,
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(200);
          ledgerAgent = res.body;
          callback();
        });
      }],
      ledgerNode: ['add', (results, callback) => {
        const agentId = 'urn:uuid:' +
          results.add.substring(results.add.lastIndexOf('/') + 1);
        brLedgerAgent.get(null, agentId, (err, result) => {
          genesisLedgerNode = result.ledgerNode;
          peers.push(genesisLedgerNode);
          callback();
        });
      }],
      genesisRecord: ['get', (results, callback) => {
        const ledgerBlockService = ledgerAgent.service.ledgerBlockService;
        request.get(helpers.createHttpSignatureRequest({
          url: ledgerBlockService,
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(200);
          callback(err, res.body.genesis);
        });
      }],
      addPeers: ['genesisRecord', (results, callback) => {
        // add N - 1 more private nodes
        async.times(nodes - 1, (i, callback) => {
          brLedgerNode.add(null, {
            genesisBlock: results.genesisRecord.block,
            owner: regularActor.identity.id
          }, (err, ledgerNode) => {
            assertNoError(err);
            peers.push(ledgerNode);
            callback();
          });
        }, callback);
      }]
    }, err => done(err));
  });

  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });

  it('should add an operations and an update operation', async function() {
    this.timeout(120000);
    const createConcertRecordOp =
      bedrock.util.clone(mockData.ops.createConcertRecord);
    const recordId = createConcertRecordOp.record.id =
      'https://example.com/events/' + uuid();
    // operations must in include `creator` which is the `targetNode`
    // exposed by the ledgerAgent
    createConcertRecordOp.creator = ledgerAgent.targetNode;
    const signed = await jsigs.sign(createConcertRecordOp, {
      documentLoader,
      algorithm: 'RsaSignature2018',
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    });
    const {httpsAgent} = brHttpsAgent;
    let error;
    try {
      await axios({
        method: 'POST',
        httpsAgent,
        url: ledgerAgent.service.ledgerOperationService,
        data: signed,
        identity: regularActor
      });
    } catch(e) {
      error = e;
    }
    should.not.exist(error);
    // operation should reach consensus in one worker cycle
    await consensusApi._worker._run(peers[0]);
    let res;
    try {
      res = await axios({
        url: ledgerAgent.service.ledgerQueryService,
        method: 'POST',
        httpsAgent,
        params: {
          id: encodeURIComponent(recordId)
        }
      });
    } catch(e) {
      error = e;
    }
    should.not.exist(error);
    res.data.record.should.eql(createConcertRecordOp.record);
    // adds an end date
    const endDate = '2017-07-14T23:30';
    const updateRecordOp = {
      '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
      creator: ledgerAgent.targetNode,
      type: 'UpdateWebLedgerRecord',
      recordPatch: {
        '@context': [constants.JSON_LD_PATCH_CONTEXT_V1_URL, {
          value: {
            '@id': 'jldp:value',
            '@context': constants.TEST_CONTEXT_V1_URL
          }
        }],
        target: recordId,
        sequence: 0,
        patch: [{
          op: 'add', path: '/endDate', value: endDate
        }]
      }
    };
    const signedUpdate = await jsigs.sign(updateRecordOp, {
      documentLoader,
      algorithm: 'RsaSignature2018',
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    });
    try {
      await axios({
        method: 'POST',
        httpsAgent,
        url: ledgerAgent.service.ledgerOperationService,
        data: signedUpdate,
        identity: regularActor
      });
    } catch(e) {
      error = e;
    }
    should.not.exist(error);
    // operation should reach consensus in one worker cycle
    await consensusApi._worker._run(peers[0]);
    let updateRes;
    try {
      updateRes = await axios({
        url: ledgerAgent.service.ledgerQueryService,
        method: 'POST',
        httpsAgent,
        params: {
          id: encodeURIComponent(recordId)
        }
      });
    } catch(e) {
      error = e;
    }
    should.not.exist(error);
    // add endDate to the local copy of the operation
    createConcertRecordOp.record.endDate = endDate;
    updateRes.data.record.should.eql(createConcertRecordOp.record);
  });
});
