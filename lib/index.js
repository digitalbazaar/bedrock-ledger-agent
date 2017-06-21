/*!
 * Ledger Agent module.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const brLedger = require('bedrock-ledger');
const config = require('bedrock').config;
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures')();
let jsonld = bedrock.jsonld;
let request = require('request');
const uuid = require('uuid/v4');
const BedrockError = bedrock.util.BedrockError;

require('bedrock-permission');

require('./config');
require('./http');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback =>
    database.openCollections(['ledgerAgents'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
      collection: 'ledgerAgents',
      fields: {id: 1},
      options: {unique: true, background: false}
    }], callback)
  ],
  doSomething: ['createIndexes', (results, callback) => {
    // FIXME: Implement any setup tasks
    callback();
  }]
}, err => callback(err)));

/**
 * Create a new ledger agent given a set of options. If a ledgerNodeId is
 * provided, a new ledger agent will be created to connect to an existing
 * ledger. If a config block is specified in the options, a new ledger and
 * corresponding ledger node will be created, ignoring any specified
 * ledgerNodeId.
 *
 * actor - the actor performing the action.
 * ledgerNodeId - the ID for the ledger node to connect to.
 * options - a set of options used when creating the agent.
 *   * configBlock - the configuration block for the agent.
 *   * storage - the storage subsystem for the ledger (default: 'mongodb').
 *   * private - if true, only the actor should be able to access the created
 *       ledger.
 * callback(err, ledger) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *     * ledgerAgent - the ledger agent associated with the agent.
 */
api.add = (actor, ledgerNodeId, options, callback) => {
  if(options.configBlock) {
    return _addNewLedgerNode(actor, options, callback);
  }

  _addNewLedgerAgent(actor, ledgerNodeId, options, callback);
};

/**
 * Gets a ledger agent given an agentId and a set of options.
 *
 * actor - the actor performing the action.
 * agentId - the URI of the agent.
 * options - a set of options used when creating the agent.
 * callback(err, ledgerAgent) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *     * ledgerAgent - A ledger agent that can be used to instruct the ledger
 *         node to perform certain actions.
 */
api.get = (actor, agentId, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerAgent(agentId));
};

/**
 * Remove an existing ledger agent given an agentId and a set of options.
 *
 * actor - the actor performing the action.
 * agentId - the URI of the agent.
 * options - a set of options used when removing the agent.
 * callback(err) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 */
api.remove = (actor, agentId, options, callback) => {
  // FIXME: Implement
  callback();
};

/**
 * Gets an iterator that will iterate over all ledger agents in the system.
 * The iterator will return a ledger agent which can be used to operate on
 * the corresponding ledger node.
 *
 * actor - the actor performing the action.
 * options - a set of options to use when retrieving the list.
 * callback(err, iterator) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *   * iterator - An iterator that returns a list of ledger agents.
 */
api.getAgentIterator = function*(actor, options, callback) {
  // FIXME: Implement
  callback(null, yield* [
    'https://example.com/ledger-agents/049f4fab7d7a',
    'https://example.com/ledger-agents/8fb5869eca6b',
    'https://example.com/ledger-agents/72e04de8572e'
  ]);
};

/**
 * Adds a new ledger agent given a ledger node identifier.
 */
function _addNewLedgerNode(actor, ledgerNodeId, options, callback) {
};

/**
 * Adds a new ledger agent given a ledger node identifier.
 */
function _addNewLedgerAgent(actor, ledgerNodeId, options, callback) {
  const laUuid = uuid();
  const routes = config['ledger-agent'].routes;
  const ledgerAgent = {
    id: 'urn:uuid:' + laUuid,
    ledgerNode: ledgerNodeId,
    ledgerAgentStatusService: routes.agents + '/' + laUuid,
    ledgerEventService: routes.events.replace(':agentId', laUuid),
    ledgerBlockService: routes.blocks.replace(':agentId', laUuid),
    ledgerQueryService: routes.query.replace(':agentId', laUuid),
  };

  const record = {
    id: database.hash(ledgerAgent.id),
    ledgerNode: database.hash(ledgerAgent.ledgerNode),
    ledgerAgent: ledgerAgent,
    meta: {
      owner: options.owner ?
        database.hash(options.owner) : database.hash(actor),
    }
  };

  async.auto({
    // check both create and access permission
    checkPermission: callback => {
      async.auto({
        checkCreate: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_CREATE, {
            resource: ledgerAgent,
            translate: 'meta.owner'
          }, callback),
        checkAccess: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_ACCESS, {
            resource: ledgerAgent,
            translate: 'meta.owner'
          }, callback),
      }, err => {
        callback(err);
      });
    },
    createLedgerNode: ['checkPermission', (results, callback) =>
      brLedger.add(actor, options.configBlock, options, callback)
    ],
    insert: ['createLedgerNode', (results, callback) => {
      database.collections.ledgerAgent.insert(
        record, database.writeOptions, (err, result) => {
          if(err && database.isDuplicateError(err)) {
            return callback(new BedrockError(
              'Duplicate ledger agent.', 'DuplicateError', {
                public: true,
                httpStatusCode: 409
              }));
          }
          callback(err, result);
        });
    }],
    createLedgerAgent: ['insert', (results, callback) => {
      const laOptions = _.cloneDeep(ledgerAgent);
      laOptions.node = results.createLedgerNode;
      const la = new LedgerAgent(laOptions);
      callback(null, la);
    }]
  }, (err, results) =>
    err ? callback(err) : callback(null, results.createLedgerAgent)
  );
}

/**
 * Ledger Agent class that exposes the agent ID and ledger node.
 */
class LedgerAgent {
  constructor(options) {
    this.id = options.agentId;
    this.node = options.node;
  }
}
