/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const util = require('util');
const async = require('async');
const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerNode = require('bedrock-ledger-node');
const brLedgerAgent = require('bedrock-ledger-agent');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const mockPlugin = require('./mock.plugin');
const querystring = require('querystring');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
// require('request-debug')(request);
const url = require('url');
const {config, util: {uuid}} = bedrock;
const {purpose} = mockData;

// register a mock ledgerAgentPlugin
try {
  brLedgerNode.use('mock', mockPlugin);
} catch(e) {
  // error means that plugin is already defined, ignore
}

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

const addLedgerAgentAsync = util.promisify(brLedgerAgent.add);

describe('Ledger Agent HTTP API', () => {
  let signedConfig;
  let defaultLedgerAgent;
  let publicLedgerAgent;

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });

  before(async () => {
    const regularActor = await brAccount.getCapabilities(
      {id: mockData.accounts.regularUser.identity.id});
    signedConfig = await jsigs.sign(mockData.ledgerConfigurations.uni, {
      documentLoader,
      suite: mockData.accounts.regularUser.suite,
      purpose
    });
    const options = {
      ledgerConfiguration: signedConfig,
      owner: regularActor.id,
    };
    console.log(regularActor, options);
    await addLedgerAgentAsync(regularActor, null, options);
    const publicOps = Object.assign({public: true}, options);
    await addLedgerAgentAsync(regularActor, null, publicOps);
  });
  beforeEach(async function() {
    await helpers.removeCollection('ledger_testLedger');
  });
  describe('authenticated as regularUser', () => {
    const regularActor = mockData.accounts.regularUser;

    it.only('should add ledger agent for new ledger', done => {
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
        getRegularUser: callback => brAccount.get(
          null, mockData.accounts.regularUser.identity.id,
          (err, identity) => callback(err, identity)),
        createNode: ['getRegularUser', (results, callback) => {
          brLedgerNode.add(results.getRegularUser, options, callback);
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
            result.ledgerNode.id.should.equal(results.createNode.id);
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
            _testService(result.service);
            result.owner.should.equal(regularActor.identity.id);
            result.name.should.equal(options.name);
            result.description.should.equal(options.description);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get an existing ledger agent with a plugin', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        description: uuid(),
        name: uuid(),
        plugins: ['mock']
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
            const {service} = result;
            _testService(service);
            should.exist(service[mockPlugin.api.serviceType]);
            service[mockPlugin.api.serviceType].should.be.an('object');
            should.exist(service[mockPlugin.api.serviceType].id);
            service[mockPlugin.api.serviceType].id.should.be.a('string');
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
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: defaultLedgerAgent.service.ledgerOperationService,
          body: results.signOperation,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })]
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
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: defaultLedgerAgent.service.ledgerOperationService,
          body: results.signOperation,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback(null, res.headers.location);
        })],
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
    it('should query for a record successfully', done => {
      let listener;
      function _waitForBlockAdd(callback) {
        listener = bedrock.events.on(
          'bedrock-ledger-storage.block.add', event => callback(null, event));
      }
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id = `https://example.com/events/${uuid()}`;
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: defaultLedgerAgent.service.ledgerOperationService,
          body: results.signOperation,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })],
        waitForBlock: callback => _waitForBlockAdd(callback),
        query: ['add', 'waitForBlock', (results, callback) => {
          // remove event listener
          listener._eventListeners['bedrock-ledger-storage.block.add'].pop();
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
            should.exist(res.body.record);
            should.exist(res.body.meta);
            res.body.record.should.deep.equal(createConcertRecordOp.record);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
  });

  describe('unauthenticated clients', () => {
    const regularActor = mockData.accounts.regularUser;

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
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: publicLedgerAgent.service.ledgerOperationService,
          body: results.signOperation
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })]
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
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: publicLedgerAgent.service.ledgerOperationService,
          body: results.signOperation,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(202);
          callback(null, res.headers.location);
        })],
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
    it('should query for a record successfully', done => {
      let listener;
      function _waitForBlockAdd(callback) {
        listener = bedrock.events.on(
          'bedrock-ledger-storage.block.add', event => callback(null, event));
      }
      const createConcertRecordOp =
        bedrock.util.clone(mockData.ops.createConcertRecord);
      createConcertRecordOp.record.id = `https://example.com/events/${uuid()}`;
      async.auto({
        signOperation: callback => jsigs.sign(createConcertRecordOp, {
          documentLoader,
          suite: mockData.accounts.regularUser.suite,
          purpose
        }, callback),
        add: ['signOperation', (results, callback) => request.post({
          url: publicLedgerAgent.service.ledgerOperationService,
          body: results.signOperation,
        }, (err, res) => {
          assertNoError(err);
          res.statusCode.should.equal(204);
          callback();
        })],
        waitForBlock: callback => _waitForBlockAdd(callback),
        query: ['add', 'waitForBlock', (results, callback) => {
          // remove event listener
          listener._eventListeners['bedrock-ledger-storage.block.add'].pop();
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
            should.exist(res.body.record);
            should.exist(res.body.meta);
            res.body.record.should.deep.equal(createConcertRecordOp.record);
            callback(null, res.body);
          });
        }]
      }, err => done(err));
    });
  });
});

function _testService(service) {
  service.should.be.an('object');
  should.exist(service.ledgerAgentStatusService);
  service.ledgerAgentStatusService.should.be.a('string');
  should.exist(service.ledgerConfigService);
  service.ledgerConfigService.should.be.a('string');
  should.exist(service.ledgerOperationService);
  service.ledgerOperationService.should.be.a('string');
  should.exist(service.ledgerEventService);
  service.ledgerEventService.should.be.a('string');
  should.exist(service.ledgerBlockService);
  service.ledgerBlockService.should.be.a('string');
  should.exist(service.ledgerQueryService);
  service.ledgerQueryService.should.be.a('string');
}
