/*!
 * Ledger Agent module.
 *
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
const _ = require('lodash');
const async = require('async');
const bedrock = require('bedrock');
const config = require('bedrock').config;
const crypto = require('crypto');
const database = require('bedrock-mongodb');
const jsigs = require('jsonld-signatures')();
let jsonld = bedrock.jsonld;
let request = require('request');
const BedrockError = bedrock.util.BedrockError;
const LedgerAgentBlocks = require('./ledgerAgentBlocks').LedgerAgentBlocks;
const LedgerAgentEvents = require('./ledgerAgentEvents').LedgerAgentEvents;
const LedgerAgentMeta = require('./ledgerAgentMeta').LedgerAgentMeta;
require('bedrock-permission');

require('./config');

// module permissions
const PERMISSIONS = bedrock.config.permission.permissions;

// module API
const api = {};
module.exports = api;

// const logger = bedrock.loggers.get('app');

// ensure that requests always send JSON
request = request.defaults({json: true});

// FIXME: Do not use an insecure document loader in production
// jsonld = jsonld();
const agentDocumentLoader = jsonld.documentLoaders.agent({
  secure: false,
  strictSSL: false
});
jsonld.documentLoader = (url, callback) => {
  if(url in config.constants.CONTEXTS) {
    return callback(
      null, {
        contextUrl: null,
        document: config.constants.CONTEXTS[url],
        documentUrl: url
      });
  }
  agentDocumentLoader(url, callback);
};

// use local JSON-LD processor for checking signatures
jsigs.use('jsonld', jsonld);

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

api.create = (actor, agentId, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerAgent(agentId, options.configBlock));
};

api.get = (actor, agentId, options, callback) => {
  // FIXME: Implement
  callback(null, new LedgerAgent(agentId));
};

api.delete = (actor, agentId, options, callback) => {
  // FIXME: Implement
  callback();
};

api.getAgentIterator = function*(actor, options, callback) {
  // FIXME: Implement
  callback(null, yield* [
    'https://example.com/ledger-agents/049f4fab7d7a',
    'https://example.com/ledger-agents/8fb5869eca6b',
    'https://example.com/ledger-agents/72e04de8572e'
  ]);
};

/**
 * Ledger Agent class that exposes the blocks, events, and meta APIs.
 */
class LedgerAgent {
  constructor(agentId) {
    this.meta = new LedgerAgentMeta(this);
    this.blocks = new LedgerAgentBlocks(this);
    this.events = new LedgerAgentEvents(this);
  }
}
