/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const paramCase = require('param-case');
const routes = config['ledger-agent'].routes;

module.exports = class LedgerAgent {
  constructor(options) {
    this.id = options.id;
    this.ledgerNode = options.ledgerNode;
    this.owner = options.owner;
    this.name = options.name;
    this.description = options.description;
    this.targetNode = options.targetNode;
    this.public = options.public || false;
    // remove the `urn:uuid:` prefix
    const laUuid = this.id.substring(9);

    // define core services
    const ledgerAgentStatusService = config.server.baseUri +
      routes.agents + '/' + laUuid;
    this.service = {
      ledgerAgentStatusService,
      ledgerConfigService: config.server.baseUri +
        routes.config.replace(':agentId', laUuid),
      ledgerOperationService: config.server.baseUri +
        routes.operations.replace(':agentId', laUuid),
      ledgerEventService: config.server.baseUri +
        routes.events.replace(':agentId', laUuid),
      ledgerBlockService: config.server.baseUri +
        routes.blocks.replace(':agentId', laUuid),
      ledgerQueryService: config.server.baseUri +
        routes.query.replace(':agentId', laUuid)
    };

    // ledger agent plugins define additional services
    this.plugins = options.plugins;
    for(const pluginName of this.plugins) {
      const p = brLedgerNode.use(pluginName);
      const pName = paramCase(pluginName);
      // the plugin's `serviceType` is associated with the plugin's root route
      this.service[p.api.serviceType] = {
        id: `${ledgerAgentStatusService}/plugins/${pName}`
      };
    }
  }
};
