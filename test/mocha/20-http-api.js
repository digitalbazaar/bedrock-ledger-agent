/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brLedger = require('bedrock-ledger');
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

jsigs.use('jsonld', bedrock.jsonld);

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Ledger Agent HTTP API', () => {
  const regularActor = mockData.identities.regularUser;
  let signedConfigEvent;
  let defaultLedgerAgent;

  before(done => {
    async.auto({
      prepare: callback => helpers.prepareDatabase(mockData, callback),
      signConfig: callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem:
          mockData.identities.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.identities.regularUser.keys.privateKey.publicKey
      }, (err, result) => {
        signedConfigEvent = result;
        callback(err);
      }),
      add: ['prepare', 'signConfig', (results, callback) => {
        request.post(helpers.createHttpSignatureRequest({
          url: url.format(urlObj),
          body: signedConfigEvent,
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
          defaultLedgerAgent = res.body;
          callback();
        });
      }]
    }, err => done(err));
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('authenticated as regularUser', () => {

    it('should add ledger agent for new ledger', done => {
      request.post(helpers.createHttpSignatureRequest({
        url: url.format(urlObj),
        body: signedConfigEvent,
        identity: regularActor
      }), (err, res) => {
        res.statusCode.should.equal(201);
        done(err);
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        owner: regularActor.id
      };

      async.auto({
        createNode: callback =>
          brLedger.add(regularActor, signedConfigEvent, options, callback),
        createAgent: ['createNode', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            qs: {ledgerNodeId: results.createNode.id},
            identity: regularActor
          }), (err, res) => {
            res.statusCode.should.equal(201);
            callback(err);
          });
        }]
      }, err => done(err));
    });
    it('should get an existing ledger agent', done => {
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: signedConfigEvent,
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
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get all existing ledger agents', done => {
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: signedConfigEvent,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            res.body.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get all existing ledger agents for owner', done => {
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: signedConfigEvent,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            qs: {owner: regularActor.identity.id},
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            res.body.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should add event', done => {
      const concertEvent = _.cloneDeep(mockData.events.concert);
      concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
      async.auto({
        signEvent: callback => jsigs.sign(concertEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signEvent', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerEventService,
            body: results.signEvent,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        }]
      }, err => done(err));
    });
    it('should get event', done => {
      const concertEvent = _.cloneDeep(mockData.events.concert);
      concertEvent.input[0].id = 'https://example.com/events/' + uuid(),
      async.auto({
        signEvent: callback => jsigs.sign(concertEvent, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signEvent', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerEventService,
            body: results.signEvent,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        }],
        get: ['add', (results, callback) => {
          const eventUrl = results.add;
          request.get(helpers.createHttpSignatureRequest({
            url: eventUrl,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            res.body.event.input[0].startDate.should.equal('2017-07-14T21:30');
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
    it('should get latest block', done => {
      async.auto({
        get: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerBlockService,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            should.exist(res.body.latest);
            should.exist(res.body.latest.block);
            should.exist(res.body.latest.meta);
            res.body.latest.block.type.should.equal('WebLedgerEventBlock');
            res.body.latest.meta.consensus.should.equal(true);
            callback(null, res.body);
          });
        }
      }, err => done(err));
    });
    it('should get specific block', done => {
      async.auto({
        getLatest: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerBlockService,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        },
        getBlock: ['getLatest', (results, callback) => {
          const blockUrl = defaultLedgerAgent.service.ledgerBlockService + '?' +
            querystring.stringify({id: results.getLatest.latest.block.id});
          request.get(helpers.createHttpSignatureRequest({
            url: blockUrl,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
    it.skip('should query state machine successfully', done => {
      async.auto({
        query: (results, callback) => {
          const queryUrl = defaultLedgerAgent.service.ledgerQueryService +
            querystring.format({id: 'https://example.com/events/1234'});
          request.get(helpers.createHttpSignatureRequest({
            url: queryUrl,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        }
      }, err => done(err));
    });
  });
});
