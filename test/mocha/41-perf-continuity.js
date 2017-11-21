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

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Performance - 3 Nodes - Continuity - One Signature', () => {
  const regularActor = mockData.identities.regularUser;
  let ledgerAgent;

  before(done => helpers.prepareDatabase(mockData, done));
  before(done => {
    const configEvent = bedrock.util.clone(mockData.events.configContinuity);
    async.auto({
      sign: callback => {
        jsigs.sign(configEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
          creator: regularActor.keys.publicKey.id
        }, callback);
      },
      add: ['sign', (results, callback) =>
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: {configEvent: results.sign},
          identity: regularActor
        }), (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        })
      ],
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
  const events = 100;
  let eventsPerSecond = 0;
  it('adds ' + events + ' events and blocks', function(done) {
    this.timeout(30000);
    const start = Date.now();
    async.times(events, (n, callback) => {
      const concertEvent = bedrock.util.clone(mockData.events.concert);
      concertEvent.input[0].id = 'https://example.com/events/' + uuid();
      async.auto({
        sign: callback => jsigs.sign(concertEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem: regularActor.keys.privateKey.privateKeyPem,
          creator: regularActor.keys.publicKey.id
        }, callback),
        add: ['sign', (results, callback) =>
          request.post(helpers.createHttpSignatureRequest({
            url: ledgerAgent.service.ledgerEventService,
            body: results.sign,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          })]
      }, callback);
    }, err => {
      const end = Date.now();
      const totalTime = (end - start) / 1000;
      eventsPerSecond = events / totalTime;
      done(err);
    });
  });
  it('should perform more than 5 transactions per second', done => {
    console.log('       ' + Math.floor(eventsPerSecond) + ' events per second');
    eventsPerSecond.should.be.at.least(5);
    done();
  });
});
