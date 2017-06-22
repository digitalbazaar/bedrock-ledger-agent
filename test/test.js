/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
var bedrock = require('bedrock');
require('bedrock-identity');
require('bedrock-ledger');
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-agent');
require('bedrock-server');
require('bedrock-mongodb');
require('./consensus');

require('bedrock-test');
bedrock.start();
