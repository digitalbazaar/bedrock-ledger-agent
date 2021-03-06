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
// require('request-debug')(request);
const url = require('url');
const {config, util: {uuid}} = bedrock;

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe.skip('Performance - 1 Node - Unilateral - One Signature', () => {
  const regularActor = mockData.accounts.regularUser;
  const numEvents = 100;
  let ledgerAgent;
  const signedEvents = [];

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });
  before(done => {
    async.auto({
      generateEvents: callback => async.times(numEvents, (n, callback) => {
        const concertEvent = bedrock.util.clone(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid();
        jsigs.sign(concertEvent, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.accounts.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.accounts.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedEvents.push(result);
          callback();
        });
      }, callback),
      signConfig: callback => jsigs.sign(mockData.events.config, {
        documentLoader,
        algorithm: 'RsaSignature2018',
        privateKeyPem:
          mockData.accounts.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.accounts.regularUser.keys.privateKey.publicKey
      }, callback),
      add: ['signConfig', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {configEvent: results.signConfig},
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
  let eventsPerSecond = 0;
  it('adds ' + numEvents + ' events and blocks', done => {
    const start = Date.now();
    async.times(numEvents, (n, callback) => {
      request.post(helpers.createHttpSignatureRequest({
        url: ledgerAgent.service.ledgerEventService,
        body: signedEvents[n],
        identity: regularActor
      }), (err, res) => {
        assertNoError(err);
        res.statusCode.should.equal(201);
        callback(null, res.headers.location);
      });
    }, err => {
      const end = Date.now();
      const totalTime = (end - start) / 1000;
      eventsPerSecond = numEvents / totalTime;
      done(err);
    });
  }).timeout(30000);
  it('should perform more than 5 transactions per second', done => {
    console.log('       ' + Math.floor(eventsPerSecond) + ' events per second');
    eventsPerSecond.should.be.at.least(5);
    done();
  });
});
