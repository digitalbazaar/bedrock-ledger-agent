/*!
 * Ledger Agent HTTP API.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPassport = require('bedrock-passport');
const brRest = require('bedrock-rest');
const config = require('bedrock').config;
const ensureAuthenticated = brPassport.ensureAuthenticated;
const BedrockError = bedrock.util.BedrockError;
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

  // POST /ledger-agents
  // Create a new ledger agent
  app.post(
    routes.agents, ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
    //  FIXME: Implement
    res.status(501).send({});
  });

  // GET /ledger-agents?owner={OWNER_ID}
  // Get a list of all ledger agents
  app.get(
    routes.agents, ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
    //  FIXME: Implement
    res.status(501).send({});
  });

  // GET /ledger-agent/{AGENT_ID}
  // Get status information on a particular ledger agent
  app.get(
    routes.agents + '/:agentId', ensureAuthenticated, brRest.when.prefers.ld,
    (req, res, next) => {
    //  FIXME: Implement
    res.status(501).send({});
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
