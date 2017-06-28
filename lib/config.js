/*!
 * Copyright (c) 2016-2017 Digital Bazaar, Inc. All rights reserved.
 */
const config = require('bedrock').config;
require('bedrock-server');
require('bedrock-permission');

// HTTP routes
config['ledger-agent'] = {
  routes: {
    agents: '/ledger-agents',
    events: '/ledger-agents/:agentId/events',
    blocks: '/ledger-agents/:agentId/blocks',
    query: '/ledger-agents/:agentId/query'
  }
};

// permissions
var permissions = config.permission.permissions;
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
