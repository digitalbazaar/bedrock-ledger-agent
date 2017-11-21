# Bedrock Ledger Agent

[![Build Status](https://ci.digitalbazaar.com/buildStatus/icon?job=bedrock-ledger-agent)](https://ci.digitalbazaar.com/job/bedrock-ledger-agent)

A [bedrock][] module for the creation and management of
[Web Ledger Agents](https://w3c.github.io/web-ledger/).
The Web Ledger ecosystem consists of Ledger Agents,
Ledger Nodes, Ledgers, Blocks, and Events.

![An image of the Web Ledger ecosystem](https://w3c.github.io/web-ledger/diagrams/ecosystem.svg)

## The HTTP API

* GET /ledger-agents
  * Get a list of all ledger agents
* POST /ledger-agents?owner={OWNER_ID}
  * Create a new ledger agent
* GET /ledger-agent/{AGENT_ID}
  * Get status information on a particular ledger agent
* POST /ledger-agent/{AGENT_ID}/events
  * Add a new event
* GET /ledger-agent/{AGENT_ID}/events?id=EVENT_ID
  * Get an existing event
* GET /ledger-agent/{AGENT_ID}/blocks?id=BLOCK_ID
  * Get an existing block
* GET /ledger-agent/{AGENT_ID}/query
  * Query the current state of an object in the system

## The Ledger Agent API

* Ledger Agent API
  * api.add(actor, ledgerNodeId, options, (err, ledgerAgent))
  * api.get(actor, agentId, options, (err, ledgerAgent))
  * api.remove(actor, agentId, options, callback(err))
  * api.getAgentIterator(actor, options, callback(err, iterator))

## Quick Examples

```
npm install bedrock-ledger-agent
```

```js
const agent = require('bedrock-ledger-agent');
const actor = 'admin';
const agentId = 'https://example.com/ledger-agents/eb8c22dc';
const options = {};

agent.get(actor, agentId, options, (err, ledgerAgent) => {
  ledgerAgent.node.events.add( /* new ledger event details go here */);
    /* ... do other operations on the ledger */
  });
});
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## Ledger Agent API

### Add a Ledger Agent

Create a new ledger agent given a set of options. If a ledgerNodeId is
provided, a new ledger agent will be created to connect to an
existing ledger. If a config block is specified in the options,
a new ledger and corresponding ledger node will be created, ignoring
any specified ledgerNodeId.

* actor - the actor performing the action.
* ledgerNodeId - the ID for the ledger node to connect to.
* options - a set of options used when creating the agent.
  * configEvent - the configuration event for the agent.
  * genesis - if true, create an entirely new genesis ledger (default: false).
  * storage - the storage subsystem for the ledger (default: 'mongodb').
  * private - if true, only the actor should be able to access the
      created ledger (default: true).
* callback(err, ledger) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerAgent - the ledger agent associated with the agent.

```javascript
const configEvent = {
  '@context': 'https://w3id.org/webledger/v1',
  type: 'WebLedgerConfigurationEvent',
  operation: 'Config',
  input: [{
    type: 'WebLedgerConfiguration',
    ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
    consensusMethod: 'UnilateralConsensus2017'
    eventValidator: [{
      type: 'SignatureValidator2017',
      eventFilter: [{
        type: 'EventTypeFilter',
        eventType: ['WebLedgerEvent']
      }],
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    }, {
      type: 'SignatureValidator2017',
      eventFilter: [{
        type: 'EventTypeFilter',
        eventType: ['WebLedgerConfigurationEvent']
      }],
      approvedSigner: [
        'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
      ],
      minimumSignaturesRequired: 1
    }],
    // events that are not validated by at least 1 validator will be rejected
    requireEventValidation: true
  }],
  signature: {
    type: 'LinkedDataSignature2015',
    created: '2017-10-24T05:33:31Z',
    creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
    domain: 'example.com',
    signatureValue: 'eyiOiJJ0eXAK...EjXkgFWFO'
  }
};
const options = {
  configEvent: configEvent,
  genesis: true
};

agent.add(actor, null, options, (err, ledgerAgent) => {
  if(err) {
    throw new Error('Failed to create ledger agent:', err);
  }

  console.log('Ledger agent created:', ledgerAgent.id);
});
```

### Get a Specific Ledger Agent

Gets a ledger agent given an agentId and a set of options.

* actor - the actor performing the action.
* agentId - the URI of the agent.
* options - a set of options used when creating the agent.
* callback(err, ledgerAgent) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerAgent - A ledger agent that can be used to
    instruct the ledger node to perform certain actions.

```javascript
const actor = 'admin';
const agentId = 'https://example.com/ledger-agents/eb8c22dc';
const options = {};

agent.get(actor, agentId, options, (err, ledgerAgent) => {
  if(err) {
    throw new Error('Failed to get ledger agent:', err);
  }

  console.log('Ledger agent retrieved', ledgerAgent.id);
});
```

### Remove a Ledger Agent

Remove an existing ledger agent given an agentId and a set of options.

* actor - the actor performing the action.
* agentId - the URI of the agent.
* options - a set of options used when removing the agent.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise

```javascript
const agentId = 'https://example.com/ledger-agents/eb8c22dc';
const options = {};

agent.remove(actor, agentId, options, err => {
  if(err) {
    throw new Error('Failed to remove ledger agent:', err);
  }

  console.log('Ledger agent removed.');
});
```

### Iterate Through All Ledger Agents

Gets an iterator that will iterate over all ledger agents in
the system. The iterator will return a ledger agent which
can be used to operate on the corresponding ledger node.

* actor - the actor performing the action.
* options - a set of options to use when retrieving the list.
* callback(err, iterator) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * iterator - An iterator that returns a list of ledger agents.

```javascript
const actor = 'admin';
const options = {};

bedrockagent.getagentIterator(actor, options, (err, iterator) => {
  if(err) {
    throw new Error('Failed to fetch iterator for ledger agents:', err);
  }

  for(let ledgerAgent of iterator) {
    console.log('Ledger agent:',  ledgerAgent.id);
  }
});
```

[bedrock]: https://github.com/digitalbazaar/bedrock
