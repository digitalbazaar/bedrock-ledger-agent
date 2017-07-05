/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
require('bedrock-ledger');
require('bedrock-ledger-context');
require('bedrock-ledger-agent');
require('bedrock-ledger-guard-signature');
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-consensus-uni');

require('bedrock-test');
bedrock.start();
