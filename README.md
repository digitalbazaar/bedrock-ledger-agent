# Bedrock Ledger Agent

A [bedrock][] module for the creation and management of
[Web Ledger Agents](https://w3c.github.io/web-ledger/).
The Web Ledger ecosystem consists of Ledger Agents,
Ledger agents, Ledgers, Blocks, and Events. This API
enables the management of ledger agents.

![An image of the Web Ledger ecosystem](https://w3c.github.io/web-ledger/diagrams/ecosystem.svg)

## The Ledger Agent API

* Ledger Agent API
  * api.create(actor, ledgerId, options, (err, ledgerAgent))
  * api.get(actor, agentId, options, (err, ledgerAgent))
  * api.delete(actor, agentId, options, callback(err))
  * api.getAgentIterator(actor, options, callback(err, iterator))
* Metadata API
  * ledgerAgent.meta.get(actor, options, (err, ledgerMeta))
* Blocks API
  * ledgerAgent.blocks.get(actor, blockId, options, callback(err, block))
* Events API
  * ledgerAgent.events.create(actor, event, options, (err, event))
  * ledgerAgent.events.get(actor, eventId, options, (err, event))

## Quick Examples

```
npm install bedrock-ledger-agent bedrock-ledger-storage-mongodb bedrock-ledger-authz-signature
```

```js
const agent = require('bedrock-ledger-agent');
require('bedrock-ledger-storage-mongodb');
require('bedrock-ledger-authz-signature');

const actor = 'admin';
const agentId = 'https://example.com/ledger-agents/eb8c22dc';

agent.get(actor, agentId, options, (err, ledgerAgent) => {
  ledgerAgent.events.create( /* new ledger event details go here */);
    /* ... do other operations on the ledger */
  });
});
```

## Configuration

For documentation on configuration, see [config.js](./lib/config.js).

## Ledger Agent API

### Create a Ledger Agent

Create a new ledger agent given a set of options. If a config block
is specified in the options, a new ledger will be created. If only
a ledgerId is provided, a new ledger agent will be created to connect
to an existing ledger.

* actor - the actor performing the action.
* ledgerId - the URI of the ledger to associated the agent with.
* options - a set of options used when creating the agent.
  * configBlock - the configuration block for the agent.
  * storage - the storage subsystem for the ledger (default: 'mongodb').
  * private - if true, only the actor should be able to access the 
      created ledger.
* callback(err, ledger) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * ledgerAgent - the ledger agent associated with the agent.

```javascript
const ledgerId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59';
const configBlock = {
  id: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/1',
  type: 'WebLedgerConfigurationBlock',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: {
    type: 'Continuity2017'
  },
  configurationBlockAuthorizationMethod: {
    type: 'ProofOfSignature2016',
    approvedSigner: [
      'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
    ],
    minimumSignaturesRequired: 1
  },
  eventBlockAuthorizationMethod: {
    type: 'ProofOfSignature2016',
    approvedSigner: [
      'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144'
    ],
    minimumSignaturesRequired: 1
  },
  signature: {
    type: 'RsaSignature2017',
    created: '2017-10-24T05:33:31Z',
    creator: 'did:v1:53ebca61-5687-4558-b90a-03167e4c2838/keys/144',
    domain: 'example.com',
    signatureValue: 'eyiOiJJ0eXAK...EjXkgFWFO'
  }
}
const options = {
  configBlock: configBlock
};

agent.create(actor, ledgerId, options, (err, ledgerAgent) => {
  if(err) {
    throw new Error('Failed to create ledger:', err);
  }

  console.log('Ledger agent created:', ledgerAgent.id);
});
```

### Get a Specific Ledger Agent

Gets a ledger agent given a agentId and a set of options.

* actor - the actor performing the action.
* agentId - the URI of the agent.
* options - a set of options used when creating the agent.
  * storage - the storage subsystem for the ledger (default 'mongodb').
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
    throw new Error('Failed to create ledger:', err);
  }

  console.log('Ledger agent retrieved', ledgerAgent.id);
});
```

### Delete a Ledger Agent

Delete an existing ledger given a agentId and a set of options.

* actor - the actor performing the action.
* agentId - the URI of the agent.
* options - a set of options used when deleting the agent.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise

```javascript
const agentId = 'https://example.com/ledger-agents/eb8c22dc';
const options = {};

agent.delete(actor, agentId, options, err => {
  if(err) {
    throw new Error('Failed to delete ledger agent:', err);
  }

  console.log('Ledger agent deleted.');
});
```

### Iterate Through All Ledger Agents

Gets an iterator that will iterate over all ledger agents in 
the system. The iterator will return a ledger agent ID which 
can be passed to the api.get() call to fetch an instance of 
a ledger agent.

* actor - the actor performing the action.
* options - a set of options to use when retrieving the list.
* callback(err, iterator) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise
  * iterator - An iterator that returns a list of ledger agent IDs.

```javascript
const actor = 'admin';
const options = {};

bedrockagent.getagentIterator(actor, options, (err, iterator) => {
  if(err) {
    throw new Error('Failed to fetch iterator for ledger agents:', err);
  }

  for(let agentId of iterator) {
    console.log('Ledger agent:',  agentId);
  }
});
```

## Ledger Agent Metadata API

### Get Ledger Metadata

Gets metadata associated with the ledger, such as most recent
configuration block and latest consensus block,
given a set of options.

* actor - the actor performing the action.
* options - a set of options used when retrieving the ledger metadata.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * ledgerMeta - metadata about the agent.

```javascript
ledgerAgent.meta.get(actor, options, (err, ledgerMeta) => {
  if(err) {
    throw new Error('Ledger metadata retrieval failed:', err);
  }

  console.log('Ledger metadata:', ledgerMeta);
});
```

## Blocks API

### Get a Ledger Block

Gets a block from the ledger given a blockID and a set of options.

* actor - the actor performing the action.
* blockId - the URI of the block to fetch.
* options - a set of options used when retrieving the block.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.

```javascript
const blockId = 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59/blocks/1';
const options = {};

ledgerAgent.blocks.get(actor, blockId, options, (err, block) => {
  if(err) {
    throw new Error('Block retrieval failed:', err);
  }

  console.log('Retrieved block:', blocks);
});
```

## Ledger Agent Events API

### Create a Ledger Event

Creates an event to associate with a ledger given an
event and a set of options.

* actor - the actor performing the action.
* event - the event to associate with a agent.
* options - a set of options used when creating the event.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * event - the event that was written to the database.

```javascript
const actor = 'admin';
const event = {
  '@context': 'https://schema.org/',
  type: 'Event',
  name: 'Big Band Concert in New York City',
  startDate: '2017-07-14T21:30',
  location: 'https://example.org/the-venue',
  offers: {
    type: 'Offer',
    price: '13.00',
    priceCurrency: 'USD',
    url: 'https://www.ticketfly.com/purchase/309433'
  },
  signature: {
    type: 'RsaSignature2017',
    created: '2017-05-10T19:47:15Z',
    creator: 'https://www.ticketfly.com/keys/789',
    signatureValue: 'JoS27wqa...BFMgXIMw=='
  }
}
const options = {};

ledgerAgent.events.create(actor, event, options, (err, event) => {
  if(err) {
    throw new Error('Failed to create the event:', err);
  }

  console.log('Event creation successful:', event.id);
});
```

### Get a Ledger Event

Gets an event associated with the ledger given an eventID
and a set of options.

* actor - the actor performing the action.
* eventId - the event to fetch from the agent.
* options - a set of options used when retrieving the event.
* callback(err) - the callback to call when finished.
  * err - An Error if an error occurred, null otherwise.
  * event - the event that was retrieved from the database.

```javascript
const eventId = 'urn:uuid:76b17d64-abb1-4d19-924f-427a743489f0';

ledgerAgent.events.get(actor, eventId, options, (err, event) => {
  if(err) {
    throw new Error('Event retrieval failed:', err);
  }

  console.log('Event retrieval successful:', events);
});
```

[bedrock]: https://github.com/digitalbazaar/bedrock
