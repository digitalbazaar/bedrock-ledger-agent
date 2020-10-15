/*!
 * Ledger Agent HTTP API.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedgerAgent = require('./api');
const brCooldown = require('bedrock-cooldown');
const brLedgerNode = require('bedrock-ledger-node');
const brPassport = require('bedrock-passport');
const brRest = require('bedrock-rest');
const {config} = bedrock;
const cors = require('cors');
const {BedrockError} = bedrock.util;

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

  // POST /ledger-agents
  // Create a new ledger agent
  app.options(routes.agents, cors());
  // TODO: add validation
  app.post(
    routes.agents, ensureAuthenticated, cors(), brRest.when.prefers.ld,
    (req, res, next) => {
      const ledgerNodeId = req.body.ledgerNodeId || null;
      const options = {
        owner: req.body.owner || (req.user.account && req.user.account.id)
      };
      if(req.body.description) {
        options.description = req.body.description;
      }
      if(req.body.name) {
        options.name = req.body.name;
      }
      if(req.body.public) {
        options.public = req.body.public;
      }
      if(req.body.plugins) {
        options.plugins = req.body.plugins;
      }
      // set ledgerConfiguration if ledgerNodeId not given
      if(!ledgerNodeId) {
        if(!req.body.ledgerConfiguration) {
          return next(new BedrockError(
            '`ledgerNodeId` or `ledgerConfiguration` must be specified.',
            'DataError', {
              httpStatusCode: 400,
              public: true,
              body: req.body
            }));
        }
        options.ledgerConfiguration = req.body.ledgerConfiguration;
      }

      brLedgerAgent.add(
        req.user.actor, ledgerNodeId, options, (err, ledgerAgent) => {
          if(err) {
            return next(err);
          }
          // return the saved config
          res.location(ledgerAgent.service.ledgerAgentStatusService);
          res.status(201).end();
        });
    });

  // GET /ledger-agents?owner={OWNER_ID}
  // Get a list of all ledger agents
  app.get(routes.agents, optionallyAuthenticated, cors(),
    brRest.when.prefers.ld, brRest.linkedDataHandler({
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
            if(!req.user) {
              return callback(null, []);
            }
            const {actor} = req.user || {};
            // req.query.owner could be a string or an array
            const owners = [].concat(
              req.query.owner ||
              // if no owner is in the query use the authenticated
              // account's id
              (req.user.account && req.user.account.id));
            async.each(owners, (owner, callback) =>
              brLedgerAgent.getAgentIterator(
                actor, {owner}, (err, iterator) => {
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
          }]
        }, err => {
          if(err) {
            return callback(err);
          }
          callback(null, {ledgerAgent: ledgerAgents});
        }, callback);
      }}));

  // GET /ledger-agent/{AGENT_ID}
  // Get status information on a particular ledger agent
  app.options(routes.agents + '/:agentId', cors());
  app.get(routes.agents + '/:agentId', optionallyAuthenticated,
    cors(), brRest.when.prefers.ld, (req, res, next) => {
      const agentId = 'urn:uuid:' + req.params.agentId;
      const options = {};

      if(!req.user) {
        options.public = true;
      } else {
        options.owner = req.query.owner ||
          (req.user.account && req.user.account.id);
      }

      async.auto({
        ledgerAgent: callback => brLedgerAgent.get(
          (req.user) ? req.user.actor : null, agentId, options, callback),
        latestConfig: ['ledgerAgent', (results, callback) =>
          results.ledgerAgent.ledgerNode.storage.events
            .getLatestConfig(callback)]
      }, (err, results) => {
        if(err) {
          return next(err);
        }
        res.json({
          '@context': config.constants.WEB_LEDGER_CONTEXT_V1_URL,
          description: results.ledgerAgent.description,
          id: results.ledgerAgent.service.ledgerAgentStatusService,
          latestConfigEvent: results.latestConfig.event,
          name: results.ledgerAgent.name,
          owner: results.ledgerAgent.owner || undefined,
          public: results.ledgerAgent.public || false,
          service: results.ledgerAgent.service,
          targetNode: results.ledgerAgent.targetNode || undefined,
        });
      });

    });

  // POST /ledger-agent/{AGENT_ID}/config
  // Process a ledger config
  app.options(routes.config, cors());
  app.post(routes.config, optionallyAuthenticated, cors(),
    brRest.when.prefers.ld, (req, res, next) => {
      const {actor} = req.user || {};
      const agentId = 'urn:uuid:' + req.params.agentId;
      const options = {};

      if(req.query.owner || req.user) {
        options.owner = req.query.owner ||
          (req.user.account && req.user.account.id);
      }

      async.auto({
        getLedgerAgent: callback => brLedgerAgent.get(
          (req.user) ? actor : null, agentId, options, callback),
        add: ['getLedgerAgent', (results, callback) => {
          const ledgerAgent = results.getLedgerAgent;

          if(!req.user && !ledgerAgent.public) {
            return callback(new BedrockError(
              'You must authenticate to access the given ledger agent.',
              'BadRequest', {
                httpStatusCode: 400,
                agentId,
                public: true
              }));
          }

          ledgerAgent.ledgerNode.config.change(
            {ledgerConfiguration: req.body}, callback);
        }]
      }, err => {
        if(err) {
          return next(err);
        }
        res.status(204).end();
      });
    });

  // POST /ledger-agent/{AGENT_ID}/operations
  // Process a ledger operation
  app.options(routes.operations, cors());
  app.post(routes.operations, cors(),
    brRest.when.prefers.ld, (req, res, next) => {
      if(brCooldown.isActive()) {
        return next(new BedrockError(
          'Server is overloaded.',
          'ServiceUnavailable', {
            httpStatusCode: 503,
            public: true
          }));
      }
      const agentId = 'urn:uuid:' + req.params.agentId;
      async.auto({
        ledgerAgent: callback => brLedgerAgent.get(null, agentId, callback),
        add: ['ledgerAgent', (results, callback) => {
          const {ledgerAgent} = results;
          ledgerAgent.ledgerNode.operations.add(
            {operation: req.body}, callback);
        }]
      }, err => {
        if(err) {
          return next(err);
        }
        res.status(204).end();
      });
    });

  // GET /ledger-agent/{AGENT_ID}/events?id=EVENT_ID
  // Get an existing event
  app.options(routes.events, cors());
  app.get(routes.events, optionallyAuthenticated, cors(),
    brRest.when.prefers.ld, brRest.linkedDataHandler({
      get: (req, res, callback) => {
        const {actor} = req.user || {};
        const agentId = 'urn:uuid:' + req.params.agentId;
        const eventHash = req.query.id;
        const options = {};

        if(req.query.owner || req.user) {
          options.owner = req.query.owner ||
            (req.user.account && req.user.account.id);
        }

        if(!req.user) {
          options.public = true;
        }

        async.auto({
          getLedgerAgent: callback => brLedgerAgent.get(
            (req.user) ? actor : null, agentId, options, callback),
          getEvent: ['getLedgerAgent', (results, callback) => {
            const ledgerAgent = results.getLedgerAgent;

            if(!req.user && !ledgerAgent.public) {
              return callback(new BedrockError(
                'You must authenticate to access the given ledger agent.',
                'BadRequest', {
                  httpStatusCode: 400,
                  agentId,
                  public: true
                }));
            }

            ledgerAgent.ledgerNode.events.get(eventHash, {}, callback);
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

  // GET /ledger-agent/{AGENT_ID}/blocks?id=BLOCK_ID
  // Get an existing block
  app.options(routes.blocks, cors());
  app.get(routes.blocks, optionallyAuthenticated, cors(),
    brRest.when.prefers.ld, brRest.linkedDataHandler({
      get: (req, res, callback) => {
        const {actor} = req.user || {};
        const agentId = 'urn:uuid:' + req.params.agentId;
        const blockId = req.query.id;
        const options = {};

        if(!req.user) {
          options.public = true;
        }

        async.auto({
          getLedgerAgent: callback => brLedgerAgent.get(
            (req.user) ? actor : null, agentId, options, callback),
          getBlocks: ['getLedgerAgent', (results, callback) => {
            const ledgerAgent = results.getLedgerAgent;

            if(!req.user && !ledgerAgent.public) {
              return callback(new BedrockError(
                'You must authenticate to access the given ledger agent.',
                'BadRequest', {
                  httpStatusCode: 400,
                  agentId,
                  public: true
                }));
            }

            if(blockId) {
              return callback();
            }
            async.auto({
              genesis: callback =>
                ledgerAgent.ledgerNode.blocks.getGenesis(callback),
              latest: callback =>
                ledgerAgent.ledgerNode.blocks.getLatest(callback)
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
            ledgerAgent.ledgerNode.blocks.get({blockId}, callback);
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

  // POST /ledger-agent/{AGENT_ID}/query?id=RECORD_ID
  // Query the current state for a record in the system
  app.options(routes.query, cors());
  app.post(routes.query, optionallyAuthenticated, cors(),
    brRest.when.prefers.ld, brRest.linkedDataHandler({
      get: (req, res, callback) => {
        const {actor} = req.user || {};
        const agentId = 'urn:uuid:' + req.params.agentId;
        const recordId = decodeURIComponent(req.query.id);
        const options = {};

        if(!recordId) {
          return callback(new BedrockError(
            'A record `id` must be supplied for a query.',
            'SyntaxError', {
              httpStatusCode: 400,
              public: true
            }));
        }

        async.auto({
          getLedgerAgent: callback => brLedgerAgent.get(
            (req.user) ? actor : null, agentId, options, callback),
          getRecord: ['getLedgerAgent', (results, callback) => {
            const ledgerAgent = results.getLedgerAgent;
            if(!req.user && !ledgerAgent.public) {
              return callback(new BedrockError(
                'You must authenticate to access the given ledger agent.',
                'BadRequest', {
                  httpStatusCode: 400,
                  agentId,
                  public: true
                }));
            }
            ledgerAgent.ledgerNode.records.get({recordId}, (err, result) => {
              if(err) {
                return callback(err);
              }
              callback(null, {record: result.record, meta: result.meta});
            });
          }]
        }, (err, results) => {
          if(err) {
            return callback(err);
          }
          callback(null, results.getRecord);
        });
      }
    }));

  app.use(routes.plugin, (req, res, next) => {
    const {pluginName} = req.params;
    async.auto({
      plugin: callback => _use(pluginName, callback),
      ledgerAgent: callback => _getLedgerAgent({req}, callback),
    }, (err, results) => {
      if(err) {
        if(err.name === 'NotFoundError') {
          return next();
        }
        return next(err);
      }
      const {ledgerAgent, plugin} = results;
      if(ledgerAgent.plugins.includes(pluginName) &&
        plugin.type === 'ledgerAgentPlugin') {
        req.ledgerAgent = ledgerAgent;
        return plugin.api.router(req, res, next);
      }
      next();
    });
  });
});

function _getLedgerAgent({req}, callback) {
  const {actor} = req.user || {};
  const agentId = 'urn:uuid:' + req.params.agentId;
  brLedgerAgent.get((req.user) ? actor : null, agentId, callback);
}

function _use(plugin, callback) {
  let p;
  try {
    p = brLedgerNode.use(plugin);
  } catch(e) {
    return callback(e);
  }
  callback(null, p);
}
