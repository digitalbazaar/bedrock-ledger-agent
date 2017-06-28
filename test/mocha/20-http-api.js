/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brLedger = require('bedrock-ledger');
const brLedgerAgent = require('bedrock-ledger-agent');
const config = bedrock.config;
const helpers = require('./helpers');
const mockData = require('./mock.data');
let request = require('request');
request = request.defaults({json: true, strictSSL: false});
//require('request-debug')(request);
const url = require('url');

const urlObj = {
  protocol: 'https',
  host: config.server.host,
  pathname: config['ledger-agent'].routes.agents
};

describe('Ledger Agent HTTP API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('authenticated as regularUser', () => {
    const regularActor = mockData.identities.regularUser;

    it('should add ledger agent for new ledger', done => {
      const configBlock = mockData.blocks.configBlock;

      request.post(helpers.createHttpSignatureRequest({
        url: url.format(urlObj),
        body: configBlock,
        identity: regularActor
      }), (err, res) => {
        res.statusCode.should.equal(201);
        done(err);
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const configBlock = mockData.blocks.configBlock;
      const options = {
        owner: regularActor.id
      };

      async.auto({
        createNode: callback =>
          brLedger.add(regularActor, configBlock, options, callback),
        createAgent: ['createNode', (results, callback) => {
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            qs: {ledgerNodeId: results.createNode.id},
            identity: regularActor
          }), (err, res) => {
            res.statusCode.should.equal(201);
            done(err);
          });
        }]
      }, err => done(err));
    });
    it('should get an existing ledger node', done => {
      async.auto({
        add: callback => {
          const configBlock = mockData.blocks.configBlock;
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: configBlock,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        get: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: results.add,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get all existing ledger agents', done => {
      async.auto({
        add: callback => {
          const configBlock = mockData.blocks.configBlock;
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: configBlock,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            res.body.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
    it('should get all existing ledger agents for owner', done => {
      async.auto({
        add: callback => {
          const configBlock = mockData.blocks.configBlock;
          request.post(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            body: configBlock,
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(201);
            callback(null, res.headers.location);
          });
        },
        getAll: ['add', (results, callback) => {
          request.get(helpers.createHttpSignatureRequest({
            url: url.format(urlObj),
            qs: {owner: regularActor.identity.id},
            identity: regularActor
          }), (err, res) => {
            should.not.exist(err);
            res.statusCode.should.equal(200);
            res.body.length.should.be.at.least(1);
            callback();
          });
        }]
      }, err => done(err));
    });
  });
});