/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedger = require('bedrock-ledger-node');
const brLedgerAgent = require('bedrock-ledger-agent');
const config = bedrock.config;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const querystring = require('querystring');
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

describe('Ledger Agent HTTP API', () => {
  let signedConfigEvent;
  let defaultLedgerAgent;

  before(done => helpers.prepareDatabase(mockData, done));

  before(done => {
    let regularActor;
    async.auto({
      getRegularUser: callback => brIdentity.get(
        null, mockData.identities.regularUser.identity.id, (err, result) => {
          regularActor = result;
          callback(err);
        }),
      signConfig: callback => jsigs.sign(mockData.events.config, {
        algorithm: 'LinkedDataSignature2015',
        privateKeyPem:
          mockData.identities.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.identities.regularUser.keys.privateKey.publicKey
      }, (err, result) => {
        signedConfigEvent = result;
        callback(err);
      }),
      add: ['getRegularUser', 'signConfig', (results, callback) => {
        const options = {
          configEvent: signedConfigEvent,
          owner: regularActor.id
        };
        brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
          defaultLedgerAgent = ledgerAgent;
          callback(err);
        });
      }]
    }, err => done(err));
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('authenticated as regularUser', () => {
    const regularActor = mockData.identities.regularUser;

    it('should add ledger agent for new ledger', done => {
      request.post(helpers.createHttpSignatureRequest({
        url: url.format(urlObj),
        body: {configEvent: signedConfigEvent},
        identity: regularActor
      }), (err, res) => {
        res.statusCode.should.equal(201);
        should.exist(res.headers.location);
        done(err);
      });
    });
    it('should add ledger agent specifying with name and description', done => {
      const options = {
        name: uuid(),
        description: uuid(),
        configEvent: signedConfigEvent
      };
      async.auto({
        createAgent: callback =>
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: options,
            identity: regularActor
          }), (err, res) => {
            res.statusCode.should.equal(201);
            callback(err, res.headers.location);
          }),
        getAgent: ['createAgent', (results, callback) => {
          const agentId = results.createAgent.substring(
            results.createAgent.lastIndexOf('/') + 1);
          const agentUrn = `urn:uuid:${agentId}`;
          brLedgerAgent.get(null, agentUrn, (err, result) => {
            should.not.exist(err);
            result.name.should.equal(options.name);
            result.description.should.equal(options.description);
            callback();
          });
        }]
      }, done);
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        owner: regularActor.identity.id,
        configEvent: signedConfigEvent
      };
      async.auto({
        getRegularUser: callback => brIdentity.get(
          null, mockData.identities.regularUser.identity.id,
          (err, identity) => callback(err, identity)),
        createNode: ['getRegularUser', (results, callback) => {
          brLedger.add(results.getRegularUser, options, callback);
        }],
        createAgent: ['createNode', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: {ledgerNodeId: results.createNode.id},
            identity: regularActor
          }), (err, res) => {
            res.statusCode.should.equal(201);
            should.exist(res.headers.location);
            callback(err, res.headers.location);
          });
        }],
        getAgent: ['createAgent', (results, callback) => {
          const agentId = results.createAgent.substring(
            results.createAgent.lastIndexOf('/') + 1);
          const agentUrn = `urn:uuid:${agentId}`;
          brLedgerAgent.get(null, agentUrn, (err, result) => {
            should.not.exist(err);
            result.node.id.should.equal(results.createNode.id);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get an existing ledger agent', done => {
      const options = {
        configEvent: signedConfigEvent,
        description: uuid(),
        name: uuid()
      };
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: options,
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
            const result = res.body;
            should.exist(result.id);
            should.exist(result.service);
            result.service.should.be.an('object');
            result.owner.should.equal(regularActor.identity.id);
            result.name.should.equal(options.name);
            result.description.should.equal(options.description);
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
            body: {configEvent: signedConfigEvent},
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
            body: {configEvent: signedConfigEvent},
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
      const concertEvent = bedrock.util.clone(mockData.events.concert);
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
      const concertEvent = bedrock.util.clone(mockData.events.concert);
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
    it('should get genesis block', done => {
      async.auto({
        get: callback => {
          request.get(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerBlockService,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            should.exist(res.body.genesis);
            should.exist(res.body.genesis.block);
            should.exist(res.body.genesis.meta);
            res.body.genesis.block.type.should.equal('WebLedgerEventBlock');
            should.not.exist(res.body.genesis.block.previousBlock);
            should.not.exist(res.body.genesis.block.previousBlockHash);
            res.body.genesis.meta.consensus.should.equal(true);
            callback(null, res.body);
          });
        }
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
    it('should query state machine successfully', done => {
      const concertEvent = bedrock.util.clone(mockData.events.concert);
      concertEvent.input[0].id = 'https://example.com/eventszzz/' + uuid(),
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
        query: ['add', (results, callback) => {
          const queryUrl = defaultLedgerAgent.service.ledgerQueryService;
          request.post(helpers.createHttpSignatureRequest({
            url: queryUrl,
            identity: regularActor,
            headers: [{
              name: 'accept',
              value: 'application/ld+json'
            }],
            qs: {id: concertEvent.input[0].id}
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            should.exist(res.body);
            should.exist(res.body.object);
            should.exist(res.body.meta);
            res.body.object.should.deep.equal(concertEvent.input[0]);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
  });
});
