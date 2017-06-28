/*!
 * Ledger Agent module API.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const brLedger = require('bedrock-ledger');
const config = require('bedrock').config;
const database = require('bedrock-mongodb');
const uuid = require('uuid/v4');
const BedrockError = bedrock.util.BedrockError;

require('bedrock-permission');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

bedrock.events.on('bedrock-mongodb.ready', callback => async.auto({
  openCollections: callback =>
    database.openCollections(['ledgerAgent'], callback),
  createIndexes: ['openCollections', (results, callback) =>
    database.createIndexes([{
      collection: 'ledgerAgent',
      fields: {id: 1},
      options: {unique: true, background: false}
    }, {
      collection: 'ledgerAgent',
      fields: {ledgerNode: 1},
      options: {unique: false, background: false}
    }, {
      collection: 'ledgerAgent',
      fields: {'meta.owner': 1},
      options: {unique: false, background: false}
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
 *   * owner (required) - the owner of the ledger node and agent.
 *   * storage - the storage subsystem for the ledger (default: 'mongodb').
 *   * private - if true, only the owner should be able to access the created
 *       ledger (default: false).
 * callback(err, ledger) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *     * ledgerAgent - the ledger agent associated with the agent.
 */
api.add = (actor, ledgerNodeId, options, callback) => {
  // FIXME: we probably want private to default to false
  const createOptions = _.defaultsDeep(options, {
    storage: 'mongodb',
    private: false
  });

  // owner must be specified
  if(!options.owner) {
    return callback(new BedrockError(
      'Ledger agent owner not specified.',
      'BadRequest',
      {httpStatusCode: 404, public: true}
    ));
  }

  // add a new ledger node if one was specified
  if(createOptions.configBlock) {
    return _addNewLedgerNode(actor, createOptions, callback);
  }

  _addNewLedgerAgent(actor, ledgerNodeId, createOptions, callback);
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
  const query = {
    id: database.hash(agentId),
    'meta.deleted': {
      $exists: false
    }
  };
  async.auto({
    find: callback => database.collections.ledgerAgent.findOne(
      query, {}, callback),
    checkPermission: ['find', (results, callback) => {
      const record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger agent not found.',
          'NotFound',
          {httpStatusCode: 404, ledgerAgentId: agentId, public: true}
        ));
      }
      brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_AGENT_ACCESS,
        {resource: record.meta, translate: 'owner'}, callback);
    }],
    getLedgerNode: ['checkPermission', (results, callback) => brLedger.get(
      actor, results.find.ledgerAgent.ledgerNode, options, callback)
    ],
    createLedgerAgent: ['getLedgerNode', (results, callback) => {
      const record = results.find;
      const laOptions = {
        id: record.ledgerAgent.id,
        node: results.getLedgerNode,
        ledgerAgentStatusService: record.ledgerAgent.ledgerAgentStatusService,
        ledgerEventService: record.ledgerAgent.ledgerEventService,
        ledgerBlockService: record.ledgerAgent.ledgerBlockService,
        ledgerQueryService: record.ledgerAgent.ledgerQueryService
      };
      callback(null, new LedgerAgent(laOptions));
    }]
  }, (err, results) => {
    callback(err, results.createLedgerAgent);
  });
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
  // owner must be specified
  if(!options.owner) {
    return callback(new BedrockError(
      'Ledger agent owner not specified.',
      'BadRequest',
      {httpStatusCode: 404, public: true}
    ));
  }

  async.auto({
    find: callback => database.collections.ledgerAgent.findOne({
      id: database.hash(agentId)
    }, callback),
    checkPermission: ['find', (results, callback) => {
      if(!results.find) {
        return callback(new BedrockError(
          'Ledger agent not found.',
          'NotFound',
          {httpStatusCode: 404, ledger: agentId, public: true}
        ));
      }
      const record = results.find;
      brPermission.checkPermission(
        actor, PERMISSIONS.LEDGER_AGENT_REMOVE, {
          resource: record.meta,
          translate: 'owner'
        }, callback);
    }],
    update: ['checkPermission', (results, callback) =>
      database.collections.ledgerAgent.update({
        id: database.hash(agentId)
      }, {
        $set: {
          'meta.deleted': Date.now()
        }
      }, database.writeOptions, callback)
    ]
  }, err => callback(err));
};

/**
 * Gets an iterator that will iterate over all ledger agents in the system.
 * The iterator will return a ledger agent which can be used to operate on
 * the corresponding ledger node.
 *
 * actor - the actor performing the action.
 * options - a set of options to use when retrieving the list.
 *   * owner (required) - filter results by this owner.
 * callback(err, iterator) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *   * iterator - An iterator that returns a list of ledger agents.
 */
api.getAgentIterator = function(actor, options, callback) {
  // owner must be specified
  if(!options.owner) {
    return callback(new BedrockError(
      'Ledger agent owner not specified.',
      'BadRequest',
      {httpStatusCode: 404, public: true}
    ));
  }

  async.auto({
    find: callback => {
      // find all non-deleted ledger agents
      const query = {
        'meta.deleted': {
          $exists: false
        },
        'meta.owner': options.owner
      };
      const projection = {
        'ledgerAgent.id': 1
      };
      database.collections.ledgerAgent.find(query, projection, callback);
    },
    hasNext: ['find', (results, callback) => {
      // check to see if there are any ledger agents
      results.find.hasNext().then(hasNext => callback(null, hasNext), callback);
    }]
  }, (err, results) => {
    if(err) {
      return callback(err);
    }

    // create a ledger agent iterator
    const iterator = {
      done: !results.hasNext
    };
    iterator.next = () => {
      if(iterator.done) {
        return {done: true};
      }
      const cursor = results.find;
      const promise = cursor.next().then(record => {
        // ensure iterator will have something to iterate over next
        return cursor.hasNext().then(hasNext => {
          iterator.done = !hasNext;
          return new Promise((resolve, reject) => {
            const getOptions = {
              owner: options.owner
            };
            api.get(actor, record.ledgerAgent.id, getOptions, (err, ledgerAgent) =>
              err ? reject(err) : resolve(ledgerAgent));
          });
        });
      }).catch(err => {
        iterator.done = true;
        throw err;
      });
      return {value: promise, done: iterator.done};
    };
    iterator[Symbol.iterator] = () => {
      return iterator;
    };

    callback(null, iterator);
  });
};

/**
 * Adds a new ledger node and then adds a ledger agent for that ledger node.
 */
function _addNewLedgerNode(actor, options, callback) {
  async.auto({
    // check both create and access permission
    checkPermission: callback => {
      async.auto({
        checkCreate: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_CREATE, {
            resource: options.owner
          }, callback),
        checkAccess: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_ACCESS, {
            resource: options.owner
          }, callback),
      }, err => {
        callback(err);
      });
    },
    createLedgerNode: ['checkPermission', (results, callback) => {
      brLedger.add(actor, options.configBlock, options, callback);
    }],
  }, (err, results) => {
    if(err) {
      return callback(err);
    }
    const ledgerNodeId = results.createLedgerNode.id;
    _addNewLedgerAgent(actor, ledgerNodeId, options, callback);
  });
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
    ledgerAgentStatusService: config.server.baseUri +
      routes.agents + '/' + laUuid,
    ledgerEventService: config.server.baseUri +
      routes.events.replace(':agentId', laUuid),
    ledgerBlockService: config.server.baseUri +
      routes.blocks.replace(':agentId', laUuid),
    ledgerQueryService: config.server.baseUri +
      routes.query.replace(':agentId', laUuid),
  };

  const record = {
    id: database.hash(ledgerAgent.id),
    ledgerNode: database.hash(ledgerAgent.ledgerNode),
    ledgerAgent: ledgerAgent,
    meta: {
      owner: options.owner
    }
  };

  async.auto({
    // check both create and access permission
    checkPermission: callback => {
      async.auto({
        checkCreate: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_CREATE, {
            resource: record.meta.owner
          }, callback),
        checkAccess: callback => brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_ACCESS, {
            resource: record.meta.owner
          }, callback),
      }, err => {
        callback(err);
      });
    },
    getLedgerNode: ['checkPermission', (results, callback) =>
      brLedger.get(actor, ledgerNodeId, options, callback)
    ],
    insert: ['getLedgerNode', (results, callback) => {
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
      laOptions.node = results.getLedgerNode;
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
    this.id = options.id;
    this.node = options.node;
    this.service = {
      ledgerAgentStatusService: options.ledgerAgentStatusService,
      ledgerEventService: options.ledgerEventService,
      ledgerBlockService: options.ledgerBlockService,
      ledgerQueryService: options.ledgerQueryService
    };
  }
}
