/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should, assertNoError */
'use strict';

const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brLedgerAgent = require('bedrock-ledger-agent');
const brLedgerNode = require('bedrock-ledger-node');
const config = bedrock.config;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
// require('request-debug')(request);
const url = require('url');
const uuid = require('uuid/v4');
const querystring = require('querystring');

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Integration - 4 Nodes - Continuity - One Signature', () => {
  const regularActor = mockData.identities.regularUser;
  const nodes = 4;
  let ledgerAgent;
  let consensusApi;
  let genesisLedgerNode;
  const peers = [];

  before(done => helpers.prepareDatabase(mockData, done));
  before(function(done) {
    this.timeout(60000);
    async.auto({
      consensusApi: callback =>
        brLedgerNode.use('Continuity2017', (err, result) => {
          consensusApi = result.api;
          callback(err);
        }),
      sign: callback => {
        jsigs.sign(mockData.events.configContinuity, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
          creator: regularActor.keys.publicKey.id
        }, callback);
      },
      add: ['sign', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {configEvent: results.sign},
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
          genesisLedgerNode = result.node;
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
            peers.push(ledgerNode);
            callback();
          });
        }, callback);
      }]
    }, err => done(err));
  });

  before(done => {
    async.map(peers, (ledgerNode, callback) => {
      consensusApi._voters.get(ledgerNode.id, (err, result) => {
        if(err) {
          return callback(err);
        }
        callback(null, {id: result.id});
      });
    }, (err, result) => {
      if(err) {
        return done(err);
      }
      consensusApi._election._recommendElectors =
        (ledgerNode, voter, electors, manifest, callback) => {
          callback(null, result);
        };
      done();
    });
  });

  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  it('should add 10 events and blocks', function(done) {
    this.timeout(60000);
    async.timesSeries(10, (n, callback) => {
      async.auto({
        sign: callback => {
          const concertEvent = bedrock.util.clone(mockData.events.concert);
          concertEvent.input[0].id = 'https://example.com/events/' + uuid();
          jsigs.sign(concertEvent, {
            algorithm: 'LinkedDataSignature2015',
            privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
            creator: regularActor.keys.publicKey.id
          }, callback);
        },
        addEvent: ['sign', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: ledgerAgent.service.ledgerEventService,
            body: results.sign,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        }],
        runWorkers: ['addEvent', (results, callback) =>
          async.each(peers, (ledgerNode, callback) =>
            consensusApi._worker._run(ledgerNode, callback), callback)],
        checkBlock: ['runWorkers', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: ledgerAgent.service.ledgerBlockService,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            const blockId = res.body.latest.block.id;
            const currentBlockNumber =
              parseInt(blockId.substring(blockId.lastIndexOf('/') + 1));
            const electionResults = res.body.latest.block.electionResults;
            const voteCount = electionResults.length;
            const voters = electionResults.map(v => v.voter);
            voters.should.have.same.members(
              _.uniq(voters));
            if(currentBlockNumber === 1) {
              voteCount.should.equal(1);
            } else {
              // there should be 3 or 4 voters on blocks 2+
              // this represents greater than 2/3 of the 4 electors
              voteCount.should.be.oneOf([3, 4]);
            }
            currentBlockNumber.should.equal(n + 1);
            callback();
          });
        }]
      }, callback);

    }, err => done(err));
  });
  it('should crawl to genesis block from latest block', done => {
    const maxAttempts = 20;
    let attempts = 0;
    let currentBlock;

    async.auto({
      getLatestBlock: callback => {
        request.get(helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerBlockService,
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(200);
          currentBlock = res.body.latest.block.id;
          callback(null, res.body);
        });
      },
      crawlToGenesis: ['getLatestBlock', (results, callback) => {
        let done = false;
        async.until(() => done, callback => {
          const blockUrl = ledgerAgent.service.ledgerBlockService + '?' +
            querystring.stringify({id: currentBlock});

          request.get(helpers.createHttpSignatureRequest({
            url: blockUrl,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            if(!res.body.block.previousBlock || attempts > maxAttempts) {
              done = true;
              return callback(null, res.body);
            }
            currentBlock = res.body.block.previousBlock;
            attempts++;
            callback(null, currentBlock);
          });
        }, (err, finalBlock) => {
          if(err) {
            return callback(err);
          }
          should.exist(finalBlock);
          should.exist(finalBlock.block);
          should.not.exist(finalBlock.block.previousBlock);
          should.not.exist(finalBlock.block.previousBlockHash);
          callback();
        });
      }]
    }, err => done(err));
  });
});
