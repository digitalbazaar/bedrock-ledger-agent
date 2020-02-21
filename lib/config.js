/*!
 * Copyright (c) 2016-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
require('bedrock-server');
require('bedrock-permission');

// HTTP routes
config['ledger-agent'] = {
  routes: {
    agent: '/ledger-agents/:agentId',
    agents: '/ledger-agents',
    blocks: '/ledger-agents/:agentId/blocks',
    config: '/ledger-agents/:agentId/config',
    events: '/ledger-agents/:agentId/events',
    operations: '/ledger-agents/:agentId/operations',
    plugin: '/ledger-agents/:agentId/plugins/:pluginName',
    plugins: '/ledger-agents/:agentId/plugins',
    query: '/ledger-agents/:agentId/query',
  }
};

// permissions
const permissions = config.permission.permissions;
permissions.LEDGER_AGENT_ACCESS = {
  id: 'LEDGER_AGENT_ACCESS',
  label: 'Access Ledger Agent',
  comment: 'Required to access a Ledger Agent.'
};
permissions.LEDGER_AGENT_CREATE = {
  id: 'LEDGER_AGENT_CREATE',
  label: 'Create Ledger Agent',
  comment: 'Required to create a Ledger Agent.'
};
permissions.LEDGER_AGENT_REMOVE = {
  id: 'LEDGER_AGENT_REMOVE',
  label: 'Remove Ledger Agent',
  comment: 'Required to remove a Ledger Agent.'
};
