/*!
 * Ledger Agent HTTP API.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brLedgerAgent = require('./api');
const brPassport = require('bedrock-passport');
const brRest = require('bedrock-rest');
const config = require('bedrock').config;
const cors = require('cors');
const docs = require('bedrock-docs');

const ensureAuthenticated = brPassport.ensureAuthenticated;
const validate = require('bedrock-validation').validate;
const BedrockError = bedrock.util.BedrockError;

require('bedrock-express');
require('bedrock-permission');

require('./config');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

const logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-express.configure.routes', app => {
  const routes = config['ledger-agent'].routes;

  app.options(routes.agents, cors());

  // POST /ledger-agents
  // Create a new ledger agent
  app.post(
    routes.agents, ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
      const ledgerNodeId = req.query.ledgerNodeId || null;
      const options = {
        owner: req.query.owner || req.user.identity.id
      };

      // set config block if ledgerNodeId not given
      if(!ledgerNodeId) {
        options.configBlock = req.body;
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
  app.get(
    routes.agents, ensureAuthenticated, brRest.when.prefers.ld,
    brRest.linkedDataHandler({
      get: function(req, res, callback) {
        const actor = req.user ? req.user.identity : undefined;
        const options = {
          owner: req.query.owner || req.user.identity.id
        };
        const ledgerAgents = [];

        // get agent iterator for given owner
        brLedgerAgent.getAgentIterator(actor, options, (err, iterator) => {
          if(err) {
            return callback(err);
          }
          // get all ledger agents owned by owner
          async.eachSeries(iterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              ledgerAgents.push({
                id: ledgerAgent.id,
                service: ledgerAgent.service
              });
              callback();
            }).catch(err => { callback(err); });
          }, err => {
            if(err) {
              return callback(err);
            }
            callback(err, ledgerAgents);
          });
        });
      }
  }));
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
  app.get(
    routes.agents + '/:agentId', ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
    const agentId = 'urn:uuid:' + req.params.agentId;
    const options = {
      owner: req.query.owner || req.user.identity.id
    };

    brLedgerAgent.get(
      req.user.identity, agentId, options, (err, ledgerAgent) => {
      if(err) {
        return next(err);
      }
      // return the saved config
      res.location(ledgerAgent.service.ledgerAgentStatusService);
      res.status(201).end();
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
      //  FIXME: Implement
      res.status(501).send({});
    });

  // GET /ledger-agent/{AGENT_ID}/events?id=EVENT_ID
  // Get an existing event
  app.get(routes.events, ensureAuthenticated,
    brRest.when.prefers.ld, (req, res, next) => {
      //  FIXME: Implement
      res.status(501).send({});
    });

  // GET /ledger-agent/{AGENT_ID}/blocks?id=BLOCK_ID
  // Get an existing block
  app.get(routes.blocks, ensureAuthenticated,
    brRest.when.prefers.ld, (req, res, next) => {
      //  FIXME: Implement
      res.status(501).send({});
    });

  // POST /ledger-agent/{AGENT_ID}/query
  // Query the current state of an object in the system
  app.post(routes.query, ensureAuthenticated,
    brRest.when.prefers.ld, (req, res, next) => {
      //  FIXME: Implement
      res.status(501).send({});
    });
});
