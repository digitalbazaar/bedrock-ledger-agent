/*
 * Copyright (c) 2017-2019 Digital Bazaar, Inc. All rights reserved.
 */

const {config} = require('bedrock');
const path = require('path');
require('bedrock-permission');

const permissions = config.permission.permissions;
const roles = config.permission.roles;

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// MongoDB
config.mongodb.name = 'bedrock_ledger_agent_test';
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

roles['bedrock-ledger-agent.test'] = {
  id: 'bedrock-ledger-agent.test',
  label: 'Test Role',
  comment: 'Role for Test User',
  sysPermission: [
    permissions.LEDGER_NODE_ACCESS.id,
    permissions.LEDGER_NODE_CREATE.id,
    permissions.LEDGER_NODE_REMOVE.id,
    permissions.LEDGER_AGENT_ACCESS.id,
    permissions.LEDGER_AGENT_CREATE.id,
    permissions.LEDGER_AGENT_REMOVE.id
  ]
};

// reduce processing interval for testing
config['ledger-consensus-continuity'].worker.election.gossipInterval = 0;

// decrease delay for gossiping with the same peer
config['ledger-consensus-continuity'].gossip.coolDownPeriod = 250;

// reduce debounce in the event-writer
config['ledger-consensus-continuity'].writer.debounce = 50;

config['https-agent'].rejectUnauthorized = false;
