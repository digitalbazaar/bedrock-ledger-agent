/*!
 * Copyright (c) 2017-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {agent} = require('bedrock-https-agent');
const bedrock = require('bedrock');
const brAccount = require('bedrock-account');
const brLedgerAgent = require('bedrock-ledger-agent');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const {httpClient} = require('@digitalbazaar/http-client');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const {promisify} = require('util');
const {util: {uuid}} = bedrock;

const addLedgerAgentAsync = promisify(brLedgerAgent.add);

describe('HTTP Agent Peer Service', () => {
  let ledgerAgent;

  before(async function() {
    await helpers.prepareDatabase(mockData);
  });

  beforeEach(async function() {
    const regularActor = await brAccount.getCapabilities(
      {id: mockData.accounts.regularUser.account.id});
    const signedConfig = await jsigs.sign(mockData.ledgerConfigurations.uni, {
      documentLoader,
      algorithm: 'RsaSignature2018',
      suite: mockData.accounts.regularUser.suite,
      purpose: mockData.purpose,
      privateKeyPem:
          mockData.accounts.regularUser.keys.privateKey.privateKeyPem,
      creator: mockData.accounts.regularUser.keys.privateKey.publicKey
    });
    const options = {
      ledgerConfiguration: signedConfig,
      owner: regularActor.id,
      // specify that the mock service
      plugins: ['mock'],
    };
    ledgerAgent = await addLedgerAgentAsync(regularActor, null, options);
  });
  beforeEach(async function() {
    await helpers.removeCollection('ledger_testLedger');
  });

  describe('peer service - get all (recommended)', () => {
    it('returns empty array on no peers', async () => {
      const basePath = ledgerAgent.service.ledgerPeerService;
      let err;
      let result;
      try {
        result = await httpClient.get(basePath, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.be.an('array');
      result.data.should.have.length(0);
    });
    it('returns empty array on no recommended peers', async () => {
      const {ledgerNode} = ledgerAgent;

      // add a peer that is not recommended
      await ledgerNode.peers.add({id: `urn:uuid:${uuid()}`});

      const basePath = ledgerAgent.service.ledgerPeerService;
      let err;
      let result;
      try {
        result = await httpClient.get(basePath, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.be.an('array');
      result.data.should.have.length(0);
    });
    it('returns one recommended peer', async () => {
      const {ledgerNode} = ledgerAgent;

      // add a peer that is not recommended
      await ledgerNode.peers.add({peer: {id: `urn:uuid:${uuid()}`}});

      // add a recommended peer
      const recommendedPeer = {
        id: `urn:uuid:${uuid()}`,
        recommended: true,
      };
      await ledgerNode.peers.add({peer: recommendedPeer});

      const basePath = ledgerAgent.service.ledgerPeerService;
      let err;
      let result;
      try {
        result = await httpClient.get(basePath, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.be.an('array');
      result.data.should.have.length(1);
      result.data[0].should.eql(recommendedPeer);
    });
    it('returns three recommended peers', async () => {
      const {ledgerNode} = ledgerAgent;

      // add a peer that is not recommended
      await ledgerNode.peers.add({peer: {id: `urn:uuid:${uuid()}`}});

      // recommended peers
      const recommendedPeers = [];
      for(let i = 0; i < 3; ++i) {
        const recommendedPeer = {
          id: `urn:uuid:${uuid()}`,
          recommended: true,
        };
        recommendedPeers.push(recommendedPeer);
        await ledgerNode.peers.add({peer: recommendedPeer});
      }

      const basePath = ledgerAgent.service.ledgerPeerService;
      let err;
      let result;
      try {
        result = await httpClient.get(basePath, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.be.an('array');
      result.data.should.have.length(3);
      result.data.should.have.deep.members(recommendedPeers);
    });
  }); // end peer service - get all

  describe('peer service - get peer', () => {
    it('gets a peer', async () => {
      const {ledgerNode} = ledgerAgent;

      const nonRecommendedPeer = {id: `urn:uuid:${uuid()}`};
      // add a peer that is not recommended
      await ledgerNode.peers.add({peer: nonRecommendedPeer});

      // add a recommended peer
      const recommendedPeer = {
        id: `urn:uuid:${uuid()}`,
        recommended: true,
      };
      await ledgerNode.peers.add({peer: recommendedPeer});

      const basePath = ledgerAgent.service.ledgerPeerService;
      let err;
      let result;
      try {
        const url = `${basePath}/${encodeURIComponent(recommendedPeer.id)}`;
        result = await httpClient.get(url, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.eql(recommendedPeer);

      result = null;
      try {
        const url = `${basePath}/${encodeURIComponent(nonRecommendedPeer.id)}`;
        result = await httpClient.get(url, {agent});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.data.should.eql(nonRecommendedPeer);
    });
    it('returns NotFoundError on an unknown peer', async () => {
      const basePath = ledgerAgent.service.ledgerPeerService;
      const unknownId = `urn:uuid:${uuid()}`;
      let err;
      let result;
      try {
        const url = `${basePath}/${encodeURIComponent(unknownId)}`;
        result = await httpClient.get(url, {agent});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      should.exist(err.data);
      err.status.should.equal(404);
      err.data.type.should.equal('NotFoundError');
      err.data.details.ledgerNodeId.should.equal(ledgerAgent.ledgerNode.id);
      err.data.details.peerId.should.equal(unknownId);
    });
  }); // peer service - get peer
});
