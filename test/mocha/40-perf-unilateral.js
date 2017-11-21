/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const config = bedrock.config;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
// require('request-debug')(request);
const url = require('url');
const uuid = require('uuid/v4');

jsigs.use('jsonld', bedrock.jsonld);

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe.skip('Performance - 1 Node - Unilateral - One Signature', () => {
  const regularActor = mockData.identities.regularUser;
  const numEvents = 100;
  let ledgerAgent;
  const signedEvents = [];

  before(done => helpers.prepareDatabase(mockData, done));
  before(done => {
    async.auto({
      generateEvents: callback => async.times(numEvents, (n, callback) => {
        const concertEvent = bedrock.util.clone(mockData.events.concert);
        concertEvent.input[0].id = 'https://example.com/events/' + uuid();
        jsigs.sign(concertEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedEvents.push(result);
          callback();
        });
      }, callback),
      signConfig: callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem:
          mockData.identities.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.identities.regularUser.keys.privateKey.publicKey
      }, callback),
      add: ['signConfig', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {configEvent: results.signConfig},
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
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
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
        should.not.exist(err);
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
