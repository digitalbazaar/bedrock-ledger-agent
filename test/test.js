/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
require('bedrock-ledger-agent');
// require storage plugin
require('bedrock-ledger-storage-mongodb');
// require consensus plugin
require('bedrock-ledger-consensus-uni');

require('bedrock-test');
bedrock.start();
