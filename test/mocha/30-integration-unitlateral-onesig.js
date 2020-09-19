/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
const url = require('url');
const {config, util: {uuid}} = bedrock;
const querystring = require('querystring');

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Integration - 1 Node - Unilateral - One Signature', () => {
  const regularActor = mockData.accounts.regularUser;
  let ledgerAgent;

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });
  before(done => {
    async.auto({
      sign: callback => {
        jsigs.sign(mockData.ledgerConfigurations.uni, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          suite: mockData.accounts.regularUser.suite,
          purpose: mockData.purpose,
          privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
          creator: regularActor.keys.publicKey.id
        }, callback);
      },
      add: ['sign', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {ledgerConfiguration: results.sign},
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
      }]
    }, err => done(err));
  });
  beforeEach(async function() {
    await helpers.removeCollection('ledger_testLedger');
  });
  it('should add 10 operations and blocks', done => {
    async.times(10, (n, callback) => {
      async.auto({
        sign: callback => {
          const createConcertRecordOp =
            bedrock.util.clone(mockData.ops.createConcertRecord);
          createConcertRecordOp.record.id =
            'https://example.com/events/' + uuid();
          jsigs.sign(createConcertRecordOp, {
            documentLoader,
            algorithm: 'RsaSignature2018',
            suite: mockData.accounts.regularUser.suite,
            purpose: mockData.purpose,
            privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
            creator: regularActor.keys.publicKey.id
          }, callback);
        },
        add: ['sign', (results, callback) => request.post({
          url: ledgerAgent.service.ledgerOperationService,
          body: results.sign,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })]
      }, err => callback(err));
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
