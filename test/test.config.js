/*
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */

const config = require('bedrock').config;
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
    permissions.LEDGER_ACCESS.id,
    permissions.LEDGER_CREATE.id,
    permissions.LEDGER_REMOVE.id,
    permissions.LEDGER_AGENT_ACCESS.id,
    permissions.LEDGER_AGENT_CREATE.id,
    permissions.LEDGER_AGENT_REMOVE.id
  ]
};

// reduce processing interval for testing
config['ledger-consensus-continuity'].worker.election.gossipInterval = 0;
