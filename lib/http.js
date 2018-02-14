/*!
 * Ledger Agent HTTP API.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const async = require('async');
const bedrock = require('bedrock');
const brLedgerAgent = require('./api');
const brPassport = require('bedrock-passport');
const brRest = require('bedrock-rest');
const config = require('bedrock').config;
const cors = require('cors');
const docs = require('bedrock-docs');
const url = require('url');
const BedrockError = bedrock.util.BedrockError;

const ensureAuthenticated = brPassport.ensureAuthenticated;
const optionallyAuthenticated = brPassport.optionallyAuthenticated;

require('bedrock-express');
require('bedrock-permission');

require('./config');

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-express.configure.routes', app => {
  const routes = config['ledger-agent'].routes;

  app.options(routes.agents, cors());

  // POST /ledger-agents
  // Create a new ledger agent
  app.post(
    routes.agents, ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
      const ledgerNodeId = req.body.ledgerNodeId || null;
      const options = {
        owner: req.body.owner || req.user.identity.id
      };

      if(req.body.description) {
        options.description = req.body.description;
      }
      if(req.body.name) {
        options.name = req.body.name;
      }

      // set config block if ledgerNodeId not given
      if(!ledgerNodeId) {
        if(!req.body.configEvent) {
          return next(new BedrockError(
          '`ledgerNodeId` or `configEvent` must be specified.',
          'DataError', {
            httpStatusCode: 400,
            public: true,
            body: req.body
          }));
        }
        options.configEvent = req.body.configEvent;
      }

      brLedgerAgent.add(
        req.user.identity, ledgerNodeId, options, (err, ledgerAgent) => {
          if(err) {
            return next(err);
          }
          // return the saved config
          res.location(ledgerAgent.service.ledgerAgentStatusService);
          res.status(201).end();
        });
    });
  docs.annotate.post(routes.agents, {
    description: 'Create a new ledger agent',
    schema: 'services.ledger.postConfig',
    securedBy: ['cookie', 'hs1'],
    responses: {
      201: 'Ledger agent creation was successful. HTTP Location header ' +
        'contains URL of newly created ledger agent.',
      400: 'Ledger agent creation failed due to malformed request.',
      403: 'Ledger agent creation failed due to invalid digital signature.',
      409: 'Ledger agent creation failed due to duplicate information.'
    }
  });

  // GET /ledger-agents?owner={OWNER_ID}
  // Get a list of all ledger agents
  app.get(routes.agents, optionallyAuthenticated, brRest.when.prefers.ld,
    brRest.linkedDataHandler({
      get: (req, res, callback) => {
        const ledgerAgents = [];

        async.auto({
          publicLedgerAgents: callback => {
            if(req.query.owner) {
              return callback(null, []);
            }
            // get all public ledger agents
            const options = {public: true};
            brLedgerAgent.getAgentIterator(null, options, (err, iterator) => {
              if(err) {
                return callback(err);
              }
              // add public ledgers to list of ledger agents
              async.eachSeries(iterator, (promise, callback) => {
                promise.then(ledgerAgent => {
                  ledgerAgents.push({
                    description: ledgerAgent.description,
                    id: ledgerAgent.id,
                    name: ledgerAgent.name,
                    service: ledgerAgent.service
                  });
                  callback();
                }).catch(err => callback(err));
              }, callback);
            });
          },
          privateLedgerAgents: ['publicLedgerAgents', (results, callback) => {
            if(req.user === undefined) {
              return callback(null, []);
            }
            const actor = req.user.identity;
            // req.query.owner could be a string or an array
            const owners = [].concat(req.query.owner || req.user.identity.id);
            async.each(owners, (owner, callback) =>
              brLedgerAgent.getAgentIterator(actor, {owner}, (err, iterator) => {
                if(err) {
                  return callback(err);
                }
                // get all ledger agents owned by owner
                async.eachSeries(iterator, (promise, callback) => {
                  promise.then(ledgerAgent => {
                    ledgerAgents.push({
                      description: ledgerAgent.description,
                      id: ledgerAgent.id,
                      name: ledgerAgent.name,
                      service: ledgerAgent.service
                    });
                    callback();
                  }).catch(err => callback(err));
                }, callback);
            }), callback);
          }]}, (err, results) => {
            callback(err, ledgerAgents);
          }, callback);
    }}));
  docs.annotate.get(routes.agents, {
    description:
      'Get all ledger agents associated with the given owner.',
    securedBy: ['cookie', 'hs1'],
    responses: {
      200: {
        'application/ld+json': {
          example: 'examples/get.ledger.jsonld'
        }
      }
    }
  });

  // GET /ledger-agent/{AGENT_ID}
  // Get status information on a particular ledger agent
  app.get(routes.agents + '/:agentId', optionallyAuthenticated,
    brRest.when.prefers.ld, (req, res, next) => {
      const agentId = 'urn:uuid:' + req.params.agentId;
      const options = {};

      if(req.user === undefined) {
        options.public = true;
      } else {
        options.owner = req.query.owner || req.user.identity.id;
      }

      async.auto({
        ledgerAgent: callback => brLedgerAgent.get(
          (req.user !== undefined) ?
            req.user.identity : null, agentId, options, callback),
        latestConfig: ['ledgerAgent', (results, callback) =>
          results.ledgerAgent.node.storage.events.getLatestConfig(callback)]
      }, (err, results) => {
        if(err) {
          return next(err);
        }
        res.json({
          '@context': config.constants.WEB_LEDGER_CONTEXT_V1_URL,
          description: results.ledgerAgent.description,
          id: results.ledgerAgent.service.ledgerAgentStatusService,
          name: results.ledgerAgent.name,
          owner: results.ledgerAgent.owner || undefined,
          public: results.ledgerAgent.public || false,
          service: results.ledgerAgent.service,
          latestConfigEvent: results.latestConfig
        });
      });

    });
  docs.annotate.get(routes.agents + '/:agentId', {
    description:
      'Get status information for specific ledger agent known to this system.',
    securedBy: ['cookie', 'hs1'],
    responses: {
      200: {
        'application/ld+json': {
          example: 'examples/get.ledger.jsonld'
        }
      },
      404: 'Ledger not found.'
    }
  });

  // POST /ledger-agent/{AGENT_ID}/events
  // Add a new event
  app.post(routes.events, ensureAuthenticated,
    brRest.when.prefers.ld, (req, res, next) => {
      const agentId = 'urn:uuid:' + req.params.agentId;
      const options = {
        owner: req.query.owner || req.user.identity.id
      };

      async.auto({
        getLedgerAgent: callback => brLedgerAgent.get(
          req.user.identity, agentId, options, callback),
        addEvent: ['getLedgerAgent', (results, callback) => {
          const ledgerAgent = results.getLedgerAgent;

          ledgerAgent.node.events.add(req.body, {}, callback);
        }]
      }, (err, results) => {
        if(err) {
          return next(err);
        }
        const event = results.addEvent;

        const eventUrl = url.format({
          protocol: 'https',
          host: config.server.host,
          pathname: url.parse(req.url).pathname,
          query: {
            id: event.meta.eventHash
          }
        });

        res.location(eventUrl);
        res.status(201).end();
      });
    });
  docs.annotate.post(routes.events, {
    description: 'Request that a Ledger Agent append a new event to a ledger',
    schema: 'services.ledger.postLedgerEvent',
    securedBy: ['null'],
    responses: {
      201: 'Event was accepted for writing. HTTP Location header ' +
        'contains URL of accepted event.',
      400: 'Request failed due to malformed request.',
      403: 'Request failed due to invalid digital signature',
      409: 'Request failed due to duplicate information.'
    }
  });

  // GET /ledger-agent/{AGENT_ID}/events?id=EVENT_ID
  // Get an existing event
  app.get(routes.events, ensureAuthenticated,
    brRest.when.prefers.ld,
    brRest.linkedDataHandler({
      get: function(req, res, callback) {
        const actor = req.user ? req.user.identity : undefined;
        const agentId = 'urn:uuid:' + req.params.agentId;
        const eventHash = req.query.id;
        const options = {
          owner: req.query.owner || req.user.identity.id
        };

        async.auto({
          getLedgerAgent: callback => brLedgerAgent.get(
            actor, agentId, options, callback),
          getEvent: ['getLedgerAgent', (results, callback) => {
            const ledgerAgent = results.getLedgerAgent;
            ledgerAgent.node.events.get(eventHash, {}, callback);
          }]
        }, (err, results) => {
          if(err) {
            return callback(err);
          }
          const event = results.getEvent;
          callback(null, event);
        });
      }
    })
  );
  docs.annotate.get(routes.events, {
    description: 'Get information about a specific event.',
    securedBy: ['null'],
    responses: {
      200: {
        'application/ld+json': {
          example: 'examples/get.ledger.event.jsonld'
        }
      },
      404: 'Event was not found.'
    }
  });

  // GET /ledger-agent/{AGENT_ID}/blocks?id=BLOCK_ID
  // Get an existing block
  app.get(routes.blocks, optionallyAuthenticated, brRest.when.prefers.ld,
    brRest.linkedDataHandler({
    get: function(req, res, callback) {
      const actor = req.user ? req.user.identity : undefined;
      const agentId = 'urn:uuid:' + req.params.agentId;
      const blockId = req.query.id;
      const options = {};

      async.auto({
        getLedgerAgent: callback => brLedgerAgent.get(
          actor, agentId, options, callback),
        getBlocks: ['getLedgerAgent', (results, callback) => {
          const ledgerAgent = results.getLedgerAgent;
          if(blockId) {
            return callback();
          }
          async.auto({
            genesis: callback =>
              ledgerAgent.node.blocks.getGenesis(options, callback),
            latest: callback =>
              ledgerAgent.node.blocks.getLatest(options, callback)
          }, (err, results) => {
            if(err) {
              return callback(err);
            }

            // FIXME: doesn't follow data model/@context
            // build latest blocks structure
            const blocks = {
              genesis: {
                block: results.genesis.genesisBlock.block,
                meta: results.genesis.genesisBlock.meta
              },
              latest: {
                block: results.latest.eventBlock.block,
                meta: results.latest.eventBlock.meta
              }
            };
            callback(null, blocks);
          });
        }],
        getBlock: ['getLedgerAgent', (results, callback) => {
          const ledgerAgent = results.getLedgerAgent;
          if(!blockId) {
            return callback();
          }
          ledgerAgent.node.blocks.get(blockId, options, (err, result) => {
            if(err) {
              return callback(err);
            }

            // build block structure
            const block = {
              block: result.block,
              meta: result.meta
            };
            callback(null, block);
          });
        }]
      }, (err, results) => {
        if(err) {
          return callback(err);
        }
        if(blockId) {
          return callback(null, results.getBlock);
        }
        callback(null, results.getBlocks);
      });
    }
  }));
  docs.annotate.get(routes.blocks, {
    description: 'Get information about a specific block.',
    securedBy: ['null'],
    responses: {
      200: {
        'application/ld+json': {
          example: 'examples/get.ledger.event.jsonld'
        }
      },
      404: 'Event was not found.'
    }
  });

  // POST /ledger-agent/{AGENT_ID}/query?id=OBJECT_ID
  // Query the current state for an object in the system
  app.post(routes.query, ensureAuthenticated,
    brRest.when.prefers.ld, brRest.linkedDataHandler({
      get: function(req, res, callback) {
        const actor = req.user ? req.user.identity : undefined;
        const agentId = 'urn:uuid:' + req.params.agentId;
        const objectId = decodeURIComponent(req.query.id);
        const options = {};

        async.auto({
          getLedgerAgent: callback => brLedgerAgent.get(
            actor, agentId, options, callback),
          getObject: ['getLedgerAgent', (results, callback) => {

            const ledgerAgent = results.getLedgerAgent;
            if(!objectId) {
              return new BedrockError(
              'An object `id` must be supplied for a query.',
              'DataError', {
                httpStatusCode: 400,
                public: true
              });
            }
            ledgerAgent.node.stateMachine.get(
              objectId, options, (err, result) => {
                if(err) {
                  return callback(err);
                }

                callback(null, {object: result.object, meta: result.meta});
              });
          }]
        }, (err, results) => {
          if(err) {
            return callback(err);
          }
          callback(null, results.getObject);
        });
      }
    }));
  docs.annotate.get(routes.query, {
    description: 'Query the state machine.',
    securedBy: ['null'],
    responses: {
      200: {
        'application/ld+json': {
          example: 'examples/query.ledger.object.jsonld'
        }
      },
      404: 'Event was not found.'
    }
  });
});
