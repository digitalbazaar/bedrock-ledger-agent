/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const helpers = require('./helpers');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
// require('request-debug')(request);
const url = require('url');
const {config, util: {uuid}} = bedrock;
const querystring = require('querystring');

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Integration - 1 Node - Unilateral - Multisignature', () => {
  describe('Add events and navigate the chain', () => {
    const regularActor = mockData.accounts.regularUser;
    const alternateActor = mockData.accounts.alternateUser;
    let ledgerAgent;

    before(async function() {
      await helpers.prepareDatabase(mockData);
      const actor = await brAccount.getCapabilities(
        {id: mockData.accounts.regularUser.account.id});
      helpers.stubPassport({
        user: {
          actor,
          account: mockData.accounts.regularUser.account
        }
      });

    });
    before(done => {
      async.auto({
        signConfig: callback => helpers.multiSign(
          mockData.ledgerConfigurations.multisigBeta, [{
            suite: regularActor.suite,
            purpose: mockData.purpose,
            privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
            creator: regularActor.keys.publicKey.id
          }, {
            suite: alternateActor.suite,
            purpose: mockData.purpose,
            privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
            creator: alternateActor.keys.publicKey.id
          }], callback),
        add: ['signConfig', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: {ledgerConfiguration: results.signConfig},
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
    // beforeEach(done => {
    //   helpers.removeCollection('ledger_testLedger', done);
    // });
    it('should add 10 events and blocks', done =>
      async.times(10, (n, callback) => {
        const createConcertRecordOp =
          bedrock.util.clone(mockData.ops.createConcertRecord);
        createConcertRecordOp.record.id =
          'https://example.com/events/' + uuid();
        async.auto({
          signEvent: callback => helpers.multiSign(
            createConcertRecordOp, [{
              suite: regularActor.suite,
              purpose: mockData.purpose,
              privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
              creator: regularActor.keys.publicKey.id
            }, {
              suite: alternateActor.suite,
              purpose: mockData.purpose,
              privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
              creator: alternateActor.keys.publicKey.id
            }], callback),
          add: ['signEvent', (results, callback) => request.post({
            url: ledgerAgent.service.ledgerOperationService,
            body: results.signEvent,
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback();
          })]
        }, err => callback(err));
      }, err => done(err)));
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
  }); // end Add events and navigate the chain
  describe('Change Ledger Configuration', () => {
    const regularActor = mockData.accounts.regularUser;
    const alternateActor = mockData.accounts.alternateUser;
    const gammaActor = mockData.accounts.gamma;
    const originalSigners = [{
      suite: regularActor.suite,
      purpose: mockData.purpose,
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    }, {
      suite: alternateActor.suite,
      purpose: mockData.purpose,
      privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
      creator: alternateActor.keys.publicKey.id
    }];
    const newSigners = [{
      suite: regularActor.suite,
      purpose: mockData.purpose,
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    }, {
      suite: gammaActor.suite,
      purpose: mockData.purpose,
      privateKeyPem: gammaActor.keys.privateKey.privateKeyPem,
      creator: gammaActor.keys.publicKey.id
    }];
    let ledgerAgent;
    before(async function() {
      await helpers.prepareDatabase(mockData);
    });
    before(done => async.auto({
      signConfig: callback => helpers.multiSign(
        mockData.ledgerConfigurations.multisigBeta, originalSigners, callback),
      add: ['signConfig', (results, callback) =>
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {ledgerConfiguration: results.signConfig},
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        })],
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
    }, err => done(err)));
    // FIXME this needs to be re-implemented with a new
    // signature validator
    it.skip('changes the ledger configuration', done => async.auto({
      signOpAlpha: callback => {
        const createConcertRecordOp =
          bedrock.util.clone(mockData.ops.createConcertRecord);
        createConcertRecordOp.record.id =
          'https://example.com/events/' + uuid();
        helpers.multiSign(createConcertRecordOp, originalSigners, callback);
      },
      addOpAlpha: ['signOpAlpha', (results, callback) => request.post({
        url: ledgerAgent.service.ledgerOperationService,
        body: results.signOpAlpha,
      }, (err, res) => {
        assertNoError(err);
        res.statusCode.should.equal(204);
        callback();
      })],
      signConfigAlpha: ['addOpAlpha', (results, callback) => {
        const newConfig = bedrock.util.clone(
          mockData.ledgerConfigurations.multisigBeta);
        newConfig.sequence = 1;
        /*
        // change approvedSigners for CreateWebLedgerRecord
        newConfig.operationValidator[0].approvedSigner = [
          mockData.accounts.regularUser.account.id,
          mockData.accounts.gamma.account.id
        ];
        */
        // the original signers sign the new config
        helpers.multiSign(newConfig, originalSigners, callback);
      }],
      addConfigAlpha: ['signConfigAlpha', (results, callback) =>
        request.post(helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerConfigService,
          body: results.signConfigAlpha,
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })],
      signOpBeta: ['addConfigAlpha', (results, callback) => {
        // sign a new event with original signers
        const createConcertRecordOp =
          bedrock.util.clone(mockData.ops.createConcertRecord);
        createConcertRecordOp.record.id =
          'https://example.com/events/' + uuid();
        helpers.multiSign(createConcertRecordOp, originalSigners, callback);
      }],
      addOpBeta: ['signOpBeta', (results, callback) => request.post({
        url: ledgerAgent.service.ledgerOperationService,
        body: results.signOpBeta,
      }, (err, res) => {
        assertNoError(err);
        // this event should fail
        res.statusCode.should.equal(400);
        res.body.type.should.equal('ValidationError');
        callback();
      })],
      signOpGamma: ['addOpBeta', (results, callback) => {
        // sign a new event with the new signers
        const createConcertRecordOp =
          bedrock.util.clone(mockData.ops.createConcertRecord);
        createConcertRecordOp.record.id =
          'https://example.com/events/' + uuid();
        helpers.multiSign(createConcertRecordOp, newSigners, callback);
      }],
      addOpGamma: ['signOpGamma', (results, callback) => request.post({
        url: ledgerAgent.service.ledgerOperationService,
        body: results.signOpGamma,
      }, (err, res) => {
        assertNoError(err);
        res.statusCode.should.equal(204);
        callback();
      })]
    }, done));
  });
}); // end Integration - 1 Node - Unilateral - Multisignature
