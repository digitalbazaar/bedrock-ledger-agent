/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
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
  let signedConfig;
  let defaultLedgerAgent;
  let publicLedgerAgent;

  before(done => helpers.prepareDatabase(mockData, done));

  before(done => {
    let regularActor;
    async.auto({
      getRegularUser: callback => brIdentity.get(
        null, mockData.identities.regularUser.identity.id, (err, result) => {
          regularActor = result;
          callback(err);
        }),
      signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
        algorithm: 'RsaSignature2018',
        privateKeyPem:
          mockData.identities.regularUser.keys.privateKey.privateKeyPem,
        creator: mockData.identities.regularUser.keys.privateKey.publicKey
      }, (err, result) => {
        signedConfig = result;
        callback(err);
      }),
      addDefault: ['getRegularUser', 'signConfig', (results, callback) => {
        const options = {
          ledgerConfiguration: signedConfig,
          owner: regularActor.id,
        };
        brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
          defaultLedgerAgent = ledgerAgent;
          callback(err);
        });
      }],
      addPublic: ['getRegularUser', 'signConfig', (results, callback) => {
        const options = {
          ledgerConfiguration: signedConfig,
          owner: regularActor.id,
          public: true
        };
        brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
          publicLedgerAgent = ledgerAgent;
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
        body: {ledgerConfiguration: signedConfig},
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
        ledgerConfiguration: signedConfig
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
            assertNoError(err);
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
        ledgerConfiguration: signedConfig
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
            assertNoError(err);
            result.node.id.should.equal(results.createNode.id);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get an existing ledger agent', done => {
      const options = {
        ledgerConfiguration: signedConfig,
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
            assertNoError(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        get: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: results.add,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
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
            body: {ledgerConfiguration: signedConfig},
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            res.body.ledgerAgent.length.should.be.at.least(1);
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
            body: {ledgerConfiguration: signedConfig},
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
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
            assertNoError(err);
            res.statusCode.should.equal(200);
            res.body.ledgerAgent.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should process operation', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        `https://example.com/concerts/${uuid()}`;
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerOperationService,
            body: results.signOperation,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback();
          });
        }]
      }, err => done(err));
    });
    // FIXME: it is unknown when operations will make their way into events
    // so this test needs some tweaking if it is to figure out a URL from which
    // to fetch an event
    it.skip('should get event', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        `https://example.com/concerts/${uuid()}`;
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerOperationService,
            body: results.signOperation,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback(null, res.headers.location);
          });
        }],
        get: ['add', (results, callback) => {
          const eventUrl = results.add;
          request.get(helpers.createHttpSignatureRequest({
            url: eventUrl,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            res.body.event.operation[0].record.startDate
              .should.equal('2017-07-14T21:30');
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
            assertNoError(err);
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
            assertNoError(err);
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
            assertNoError(err);
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
            assertNoError(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
    // FIXME: this test is trying to query for an operation that has not
    // been put into a block yet, needs fixing
    it.skip('should query state machine successfully', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        'https://example.com/events/' + uuid(),
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: defaultLedgerAgent.service.ledgerOperationService,
            body: results.signOperation,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback();
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
            qs: {id: createConcertRecordOp.record.id}
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            should.exist(res.body);
            should.exist(res.body.object);
            should.exist(res.body.meta);
            res.body.object.should.deep.equal(createConcertRecordOp.record);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
  });

  describe('unauthenticated clients', () => {
    const regularActor = mockData.identities.regularUser;

    it('should not add ledger agent for new ledger', done => {
      request.post({
        url: url.format(urlObj),
        body: {ledgerConfiguration: signedConfig},
        identity: regularActor
      }, (err, res) => {
        res.statusCode.should.equal(400);
        done(err);
      });
    });
    it('should get an existing public ledger agent', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        description: uuid(),
        name: uuid(),
        public: true
      };
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: options,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        get: ['add', (results, callback) => {
          request.get({url: results.add}, (err, res) => {
            assertNoError(err);
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
    it('should get all existing public ledger agents', done => {
      async.auto({
        add: callback => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: {ledgerConfiguration: signedConfig},
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get({url: url.format(urlObj)}, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            res.body.ledgerAgent.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should process operation on public ledger', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        `https://example.com/concerts/${uuid()}`;
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post({
            url: publicLedgerAgent.service.ledgerOperationService,
            body: results.signOperation
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback();
          });
        }]
      }, err => done(err));
    });
    // FIXME: unknown when events will occur, need another way to test
    // getting an event from the event endpoint
    it.skip('should get event from public ledger', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        'https://example.com/concerts/' + uuid(),
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: publicLedgerAgent.service.ledgerOperationService,
            body: results.signOperation,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(202);
            callback(null, res.headers.location);
          });
        }],
        get: ['add', (results, callback) => {
          const eventUrl = results.add;
          request.get({
            url: eventUrl
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            res.body.event.operation[0].record.startDate.should.equal(
              '2017-07-14T21:30');
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
    it('should get genesis block from public ledger', done => {
      async.auto({
        get: callback => {
          request.get({
            url: publicLedgerAgent.service.ledgerBlockService
          }, (err, res) => {
            assertNoError(err);
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
    it('should get latest block from public ledger', done => {
      async.auto({
        get: callback => {
          request.get({
            url: publicLedgerAgent.service.ledgerBlockService
          }, (err, res) => {
            assertNoError(err);
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
    it('should get specific block from public ledger', done => {
      async.auto({
        getLatest: callback => {
          request.get({
            url: publicLedgerAgent.service.ledgerBlockService
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        },
        getBlock: ['getLatest', (results, callback) => {
          const blockUrl = publicLedgerAgent.service.ledgerBlockService + '?' +
            querystring.stringify({id: results.getLatest.latest.block.id});
          request.get({
            url: blockUrl,
            identity: regularActor
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
    // FIXME: this test is trying to query for an operation that has not
    // been put into a block yet, needs fixing
    it.skip('query state machine on public ledger successful', done => {
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id =
        'https://example.com/events/' + uuid(),
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, callback),
        add: ['signOperation', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: publicLedgerAgent.service.ledgerOperationService,
            body: results.signOperation,
            identity: regularActor
          }), (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(204);
            callback();
          });
        }],
        query: ['add', (results, callback) => {
          const queryUrl = publicLedgerAgent.service.ledgerQueryService;
          request.post({
            url: queryUrl,
            headers: [{
              name: 'accept',
              value: 'application/ld+json'
            }],
            qs: {id: createConcertRecordOp.record.id}
          }, (err, res) => {
            assertNoError(err);
            res.statusCode.should.equal(200);
            should.exist(res.body);
            should.exist(res.body.object);
            should.exist(res.body.meta);
            res.body.object.should.deep.equal(createConcertRecordOp.record);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
  });
});
