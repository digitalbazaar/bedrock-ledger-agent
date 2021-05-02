/*!
 * Ledger Agent module.
 *
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
/** @module bedrock-ledger-agent */

'use strict';

require('./config');
const api = require('./api');
require('./http');

module.exports = api;
