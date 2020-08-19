/*!
 * Ledger Agent module API.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const _ = require('lodash');
const {promisify} = require('util');
const assert = require('assert-plus');
const async = require('async');
const bedrock = require('bedrock');
const brPermission = require('bedrock-permission');
const brLedgerNode = require('bedrock-ledger-node');
const database = require('bedrock-mongodb');
const {util: {callbackify, BedrockError, uuid}} = bedrock;
const LedgerAgent = require('./LedgerAgent');

require('bedrock-permission');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(['ledgerAgent']);
  await promisify(database.createIndexes)([{
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
  }]);
});

const _getTargetNode = callbackify(async ({ledgerNode}) => {
  // some consensus algorithms may not implement this API
  if(!ledgerNode.consensus.getPeerId) {
    return;
  }
  return ledgerNode.consensus.getPeerId({ledgerNodeId: ledgerNode.id});
});

/**
 * Create a new ledger agent given a set of options. If a ledgerNodeId is
 * provided, a new ledger agent will be created to connect to an existing
 * ledger. If a config block is specified in the options and genesis
 * is set to true, a new ledger and corresponding ledger node will be created,
 * ignoring any specified ledgerNodeId.
 *
 * actor - the actor performing the action.
 * ledgerNodeId - the ID for the ledger node to connect to.
 * options - a set of options used when creating the agent.
 *   * ledgerConfiguration - the configuration for the ledger.
 *   * genesis - if true, create an entirely new genesis ledger
 *       (default: false).
 *   * owner (required) - the owner of the ledger node and agent.
 *   * storage - the storage subsystem for the ledger (default: 'mongodb').
 *   * public - if true, the agent should be accessible by anyone,
 *              false if only the owner should have access (default: false).
 * callback(err, ledger) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *     * ledgerAgent - the ledger agent associated with the agent.
 */
api.add = (actor, ledgerNodeId, options, callback) => {
  const createOptions = _.defaultsDeep(options, {
    storage: 'mongodb',
    public: false
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
  if(createOptions.ledgerConfiguration) {
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
 *   * public (optional) - true if the ledger agent should be public,
 *       false otherwise.
 * callback(err, ledgerAgent) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *     * ledgerAgent - A ledger agent that can be used to instruct the ledger
 *         node to perform certain actions.
 */
api.get = (actor, agentId, options, callback) => {
  if(typeof options === 'function') {
    callback = options;
    options = {};
  }
  const query = {
    id: database.hash(agentId),
    'meta.deleted': {
      $exists: false
    }
  };

  if(options.public !== undefined) {
    options['meta.public'] = options.public;
  }

  async.auto({
    find: callback => database.collections.ledgerAgent.findOne(
      query, {}, callback),
    checkPermission: ['find', (results, callback) => {
      const record = results.find;
      if(!record) {
        return callback(new BedrockError(
          'Ledger agent not found.',
          'NotFoundError',
          {httpStatusCode: 404, ledgerAgentId: agentId, public: true}
        ));
      }

      if(record.meta.public !== true) {
        // check permissions if the ledger agent isn't public
        return brPermission.checkPermission(
          actor, PERMISSIONS.LEDGER_AGENT_ACCESS,
          {resource: record.meta, translate: 'owner'}, callback);
      }

      callback();
    }],
    ledgerNode: ['checkPermission', (results, callback) => brLedgerNode.get(
      (results.find.meta.public !== true) ? actor : null,
      results.find.ledgerAgent.ledgerNode, options, callback)
    ],
    targetNode: ['ledgerNode', (results, callback) => _getTargetNode(
      {ledgerNode: results.ledgerNode}, callback)],
    createLedgerAgent: ['ledgerNode', 'targetNode', (results, callback) => {
      const record = results.find;
      const laOptions = {
        description: record.ledgerAgent.description,
        id: record.ledgerAgent.id,
        name: record.ledgerAgent.name,
        ledgerNode: results.ledgerNode,
        owner: record.meta.owner,
        public: record.meta.public || false,
        plugins: record.ledgerAgent.plugins,
        targetNode: results.targetNode,
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
      'DataError',
      {httpStatusCode: 400, public: true}
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
          'NotFoundError',
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
      database.collections.ledgerAgent.updateOne({
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
 *   * owner (optional) - filter results by this owner.
 *   * public (optional) - false to filter out public ledger agents.
 * callback(err, iterator) - the callback to call when finished.
 *   * err - An Error if an error occurred, null otherwise
 *   * iterator - An iterator that returns a list of ledger agents.
 */
api.getAgentIterator = function(actor, options, callback) {
  async.auto({
    find: callback => {
      // find all non-deleted ledger agents
      const query = {
        'meta.deleted': {
          $exists: false
        },
      };

      if(options.owner) {
        query['meta.owner'] = options.owner;
      }

      if(options.public) {
        query['meta.public'] = options.public;
      }

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
            const getOptions = {};
            if(options.owner) {
              getOptions.owner = options.owner;
            }
            if(options.public) {
              getOptions.public = options.public;
            }

            api.get(
              actor, record.ledgerAgent.id, getOptions, (err, ledgerAgent) =>
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
          }, callback)
      }, err => {
        callback(err);
      });
    },
    createLedgerNode: ['checkPermission', (results, callback) => {
      brLedgerNode.add(actor, options, callback);
    }]
  }, (err, results) => {
    if(err) {
      return callback(err);
    }
    const ledgerNodeId = results.createLedgerNode.id;
    _addNewLedgerAgent(actor, ledgerNodeId, options, callback);
  });
}

/**
 * Adds a new ledger agent given a ledger node identifier.
 */
function _addNewLedgerAgent(actor, ledgerNodeId, options, callback) {
  const laUuid = uuid();

  const ledgerAgent = {
    id: 'urn:uuid:' + laUuid,
    ledgerNode: ledgerNodeId,
    public: options.public || false,
  };

  if(options.name) {
    ledgerAgent.name = options.name;
  }
  if(options.description) {
    ledgerAgent.description = options.description;
  }
  assert.optionalArrayOfString(options.plugins, 'options.plugins');
  ledgerAgent.plugins = options.plugins || [];

  const record = {
    id: database.hash(ledgerAgent.id),
    ledgerNode: database.hash(ledgerAgent.ledgerNode),
    ledgerAgent,
    meta: {
      owner: options.owner,
      public: options.public
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
          }, callback)
      }, err => {
        callback(err);
      });
    },
    // validate all the specified plugins
    plugins: callback => {
      let pluginName;
      try {
        for(pluginName of ledgerAgent.plugins) {
          const p = brLedgerNode.use(pluginName);
          if(p.type !== 'ledgerAgentPlugin') {
            throw new Error('The plugin `type` must be `ledgerAgentPlugin`.');
          }
          if(!p.api.serviceType) {
            throw new Error('`serviceType` must be defined.');
          }
          if(!p.api.router) {
            throw new Error('`router` must be defined.');
          }
          if(!p.api.router.stack.some(s => s.route.path === '/')) {
            throw new Error('A root route `/` must be defined.');
          }
        }
      } catch(e) {
        return callback(new BedrockError(
          'Invalid ledger agent plugin.', 'SyntaxError',
          {httpStatusCode: 400, public: true, pluginName}, e
        ));
      }
      callback();
    },
    ledgerNode: ['checkPermission', 'plugins', (results, callback) =>
      brLedgerNode.get(actor, ledgerNodeId, options, callback)],
    insert: ['ledgerNode', (results, callback) => {
      database.collections.ledgerAgent.insertOne(
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
    targetNode: ['ledgerNode', (results, callback) => _getTargetNode(
      {ledgerNode: results.ledgerNode}, callback)],
    createLedgerAgent: ['insert', 'targetNode', (results, callback) => {
      const laOptions = bedrock.util.clone(ledgerAgent);
      laOptions.ledgerNode = results.ledgerNode;
      laOptions.targetNode = results.targetNode;
      const la = new LedgerAgent(laOptions);
      callback(null, la);
    }]
  }, (err, results) =>
    err ? callback(err) : callback(null, results.createLedgerAgent)
  );
}
