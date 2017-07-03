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

describe.skip('Performance - 1 Node - Unilateral - One Signature', () => {
  const regularActor = mockData.identities.regularUser;
  const configEvent = mockData.events.config;
  let ledgerAgent;
  let currentTest;

  before(done => helpers.prepareDatabase(mockData, done));
  before(done => {
    async.auto({
      add: callback => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: mockData.events.config,
          identity: regularActor
        }), (err, res) => {
          should.not.exist(err);
          res.statusCode.should.equal(201);
          callback(null, res.headers.location);
        });
      },
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
  it('adds ' + events + ' events and blocks', done => {
    const start = Date.now();
    async.times(events, (n, callback) => {
      const concertEvent = _.cloneDeep(mockData.events.concert);
      concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
      request.post(helpers.createHttpSignatureRequest({
        url: ledgerAgent.service.ledgerEventService,
        body: concertEvent,
        identity: regularActor
      }), (err, res) => {
        should.not.exist(err);
        res.statusCode.should.equal(201);
        callback(null, res.headers.location);
      });
    }, err => {
      const end = Date.now();
      const totalTime = (end - start) / 1000;
      eventsPerSecond = events / totalTime;
      done(err);
    })
  }).timeout(30000);
  it('should perform more than 5 transactions per second', done => {
    console.log('        ' + Math.floor(eventsPerSecond) + ' events per second');
    eventsPerSecond.should.be.at.least(5);
    done();
  })
});
