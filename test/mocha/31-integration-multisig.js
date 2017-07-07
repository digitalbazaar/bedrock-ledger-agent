/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brLedger = require('bedrock-ledger');
const brLedgerAgent = require('bedrock-ledger-agent');
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

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe('Integration - 1 Node - Unilateral - Multisignature', () => {
  describe('Add events and navigate the chain', () => {
    const regularActor = mockData.identities.regularUser;
    const alternateActor = mockData.identities.alternateUser;
    let ledgerAgent;

    before(done => helpers.prepareDatabase(mockData, done));
    before(done => {
      async.auto({
        signConfig: callback => helpers.multiSign(
          mockData.events.multisigConfigBeta, [{
            privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
            creator: regularActor.keys.publicKey.id
          }, {
            privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
            creator: alternateActor.keys.publicKey.id
          }], callback),
        add: ['signConfig', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: results.signConfig,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        }],
        get: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: results.add,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
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
        const concertEvent = _.cloneDeep(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
        async.auto({
          signEvent: callback => helpers.multiSign(
            concertEvent, [{
              privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
              creator: regularActor.keys.publicKey.id
            }, {
              privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
              creator: alternateActor.keys.publicKey.id
            }], callback),
          add: ['signEvent', (results, callback) => request.post(
            helpers.createHttpSignatureRequest({
              url: ledgerAgent.service.ledgerEventService,
              body: results.signEvent,
              identity: regularActor
            }), (err, res) => {
              should.not.exist(err);
              res.statusCode.should.equal(201);
              callback(null, res.headers.location);
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
            should.not.exist(err);
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
              should.not.exist(err);
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
    const regularActor = mockData.identities.regularUser;
    const alternateActor = mockData.identities.alternateUser;
    const gammaActor = mockData.identities.gamma;
    const originalSigners = [{
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    }, {
      privateKeyPem: alternateActor.keys.privateKey.privateKeyPem,
      creator: alternateActor.keys.publicKey.id
    }];
    const newSigners = [{
      privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
      creator: regularActor.keys.publicKey.id
    }, {
      privateKeyPem: gammaActor.keys.privateKey.privateKeyPem,
      creator: gammaActor.keys.publicKey.id
    }];
    let ledgerAgent;
    before(done => helpers.prepareDatabase(mockData, done));
    before(done => async.auto({
      signConfig: callback => helpers.multiSign(
        mockData.events.multisigConfigBeta, originalSigners, callback),
      add: ['signConfig', (results, callback) => request.post(
        helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: results.signConfig,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        })],
      get: ['add', (results, callback) => {
        request.get(helpers.createHttpSignatureRequest({
          url: results.add,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(200);
          ledgerAgent = res.body;
          callback();
        });
      }]
    }, err => done(err)));
    it('changes the ledger configuration', done => async.auto({
      signEventAlpha: callback => {
        const concertEvent = _.cloneDeep(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
        helpers.multiSign(concertEvent, originalSigners, callback)
      },
      addEventAlpha: ['signEventAlpha', (results, callback) => request.post(
        helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerEventService,
          body: results.signEventAlpha,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        })],
      signConfigAlpha: ['addEventAlpha', (results, callback) => {
        const newConfig = _.cloneDeep(mockData.events.multisigConfigBeta);
        // change approvedSigners for WebLedgerEvent
        newConfig.input[0].validationEventGuard[1].approvedSigner = [
          mockData.identities.regularUser.identity.id,
          mockData.identities.gamma.identity.id
        ];
        // the original signers sign the new config
        helpers.multiSign(newConfig, originalSigners, callback);
      }],
      addConfigAlpha: ['signConfigAlpha', (results, callback) => request.post(
        helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerEventService,
          body: results.signConfigAlpha,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        })],
      signEventBeta: ['addConfigAlpha', (results, callback) => {
        // sign a new event with original signers
        const concertEvent = _.cloneDeep(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
        helpers.multiSign(concertEvent, originalSigners, callback);
      }],
      addEventBeta: ['signEventBeta', (results, callback) => request.post(
        helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerEventService,
          body: results.signEventBeta,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          // this event should fail
          res.statusCode.should.equal(403);
          res.body.type.should.equal('GuardRejection');
          callback();
        })],
      signEventGamma: ['addEventBeta', (results, callback) => {
        // sign a new event with the new signers
        const concertEvent = _.cloneDeep(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
        helpers.multiSign(concertEvent, newSigners, callback);
      }],
      addEventGamma: ['signEventGamma', (results, callback) => request.post(
        helpers.createHttpSignatureRequest({
          url: ledgerAgent.service.ledgerEventService,
          body: results.signEventGamma,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(201);
          callback();
        })]
    }, done));
  });
}); // end Integration - 1 Node - Unilateral - Multisignature
