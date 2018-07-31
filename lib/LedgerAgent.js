/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const brLedgerNode = require('bedrock-ledger-node');
const paramCase = require('param-case');

module.exports = class LedgerAgent {
  constructor(options) {
    this.id = options.id;
    this.node = options.node;
    this.owner = options.owner;
    this.name = options.name;
    this.description = options.description;
    this.public = options.public || false;
    this.service = {
      ledgerAgentStatusService: options.ledgerAgentStatusService,
      ledgerConfigService: options.ledgerConfigService,
      ledgerOperationService: options.ledgerOperationService,
      ledgerEventService: options.ledgerEventService,
      ledgerBlockService: options.ledgerBlockService,
      ledgerQueryService: options.ledgerQueryService
    };
    // ledger agent plugins define additional services
    this.plugins = options.plugins;
    for(const pluginName of this.plugins) {
      const p = brLedgerNode.use(pluginName);
      const pName = paramCase(pluginName);
      // the plugin's `serviceType` is associated with the plugin's root route
      this.service[p.api.serviceType] = {
        id: `${options.ledgerAgentStatusService}/plugins/${pName}/`
      };
    }
  }
};
