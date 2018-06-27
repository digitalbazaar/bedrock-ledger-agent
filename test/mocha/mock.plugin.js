/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {express} = require('bedrock-express');

const api = {
  router: express.Router(),
  serviceType: 'urn:mock:foo-service',
};
module.exports = {api, type: 'ledgerAgentPlugin'};

api.router.get('/', (req, res) => {
  // `ledgerAgent` is added to the `req` object
  should.exist(req.ledgerAgent);
  res.json({success: true});
});
