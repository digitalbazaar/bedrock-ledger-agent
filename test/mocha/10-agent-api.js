/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
/* globals should */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerAgent = require('bedrock-ledger-agent');
const database = require('bedrock-mongodb');
const expect = global.chai.expect;
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe('Ledger Agent API', () => {
  before(done => {
    helpers.prepareDatabase(mockData, done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    let ledgerNodeId = null;
    const mockIdentity = mockData.identities.regularUser;
    let actor;
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it('should add a ledger agent for a new ledger', done => {
      const options = {
        configBlock: mockData.blocks.configBlock
      };

      brLedgerAgent.add(actor, null, options, (err, ledgerAgent) => {
        should.not.exist(err);
        should.exist(ledgerAgent);
        should.exist(ledgerAgent.id);
        should.exist(ledgerAgent.service.ledgerEventService);
        done();
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        configBlock: mockData.blocks.configBlock
      };

      brLedgerAgent.add(actor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {};
        const ledgerNodeId = firstLa.node.id;
        brLedgerAgent.add(actor, ledgerNodeId, options, (err, ledgerAgent) => {
          should.not.exist(err);
          should.exist(ledgerAgent);
          should.exist(ledgerAgent.id);
          should.exist(ledgerAgent.service.ledgerEventService);
          ledgerAgent.id.should.not.equal(firstLa.id);
          ledgerAgent.node.id.should.equal(ledgerNodeId);
          done();
        });
      });
    });
    it.skip('should get their ledger', done => {
      done();
    });
    it.skip('should iterate over their ledgers', done => {
      done();
    });
    it.skip('should delete their ledger', done => {
      done();
    });
    it.skip('should not get non-owned ledger', done => {
      done();
    });
    it.skip('should not delete non-owned ledger', done => {
      done();
    });
    it.skip('should not iterate over non-owned ledger agents', done => {
      done();
    });
  });
  describe.skip('admin as actor', () => {
    const mockIdentity = mockData.identities.adminUser;
    let actor;
    before(done => {
      brIdentity.get(null, mockIdentity.identity.id, (err, result) => {
        actor = result;
        done(err);
      });
    });
    it.skip('should create a ledger agent for any actor', done => {
      done();
    });
    it.skip('should get any ledger', done => {
      done();
    });
    it.skip('should iterate over all ledger agents', done => {
      done();
    });
    it.skip('should delete any ledger', done => {
      done();
    });
  });
});