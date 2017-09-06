/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerAgent = require('bedrock-ledger-agent');
const database = require('bedrock-mongodb');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const uuid = require('uuid/v4');

// use local JSON-LD processor for signatures
jsigs.use('jsonld', bedrock.jsonld);

describe('Ledger Agent API', () => {
  before(done => {
    async.series([
      callback => helpers.prepareDatabase(mockData, callback)
    ], done);
  });
  beforeEach(done => {
    helpers.removeCollection('ledger_testLedger', done);
  });
  describe('regularUser as actor', () => {
    let regularActor;
    let adminActor;
    let signedConfigEvent;
    before(done => {
      async.auto({
        getRegularUser: callback => brIdentity.get(
          null, mockData.identities.regularUser.identity.id, (err, result) => {
            regularActor = result;
            callback(err);
          }),
        getAdminUser: callback => brIdentity.get(
          null, mockData.identities.adminUser.identity.id, (err, result) => {
            adminActor = result;
            callback(err);
          }),
        signConfig: callback => jsigs.sign(mockData.events.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfigEvent = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('should add a ledger agent for a new ledger', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        should.not.exist(err);
        should.exist(ledgerAgent);
        should.exist(ledgerAgent.id);
        should.exist(ledgerAgent.service.ledgerEventService);
        should.not.exist(ledgerAgent.name);
        should.not.exist(ledgerAgent.description);
        done();
      });
    });
    it('should add a ledger agent with a name and description', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id,
        name: uuid(),
        description: uuid()
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        should.not.exist(err);
        should.exist(ledgerAgent);
        should.exist(ledgerAgent.id);
        should.exist(ledgerAgent.service.ledgerEventService);
        ledgerAgent.name.should.equal(options.name);
        ledgerAgent.description.should.equal(options.description);
        done();
      });
    });
    it('returns ValidationError if config event is not signed', done => {
      const options = {
        configEvent: mockData.events.config,
        owner: regularActor.id
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        should.exist(err);
        should.not.exist(ledgerAgent);
        err.name.should.equal('ValidationError');
        err.details.validatorReports.some(r => r.error && r.error.cause &&
          r.error.cause.includes('No signature found.')).should.be.true;
        done();
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.node.id;
        brLedgerAgent.add(
          regularActor, ledgerNodeId, options, (err, ledgerAgent) => {
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
    it('should get existing ledger agent', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          regularActor, ledgerAgentId, options, (err, ledgerAgent) => {
            should.not.exist(err);
            should.exist(ledgerAgent);
            should.exist(ledgerAgent.id);
            should.exist(ledgerAgent.service.ledgerEventService);
            ledgerAgent.id.should.equal(firstLa.id);
            done();
          });
      });
    });
    it('should iterate over their ledger agents', function(done) {
      this.timeout(60000);
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };
      const testAgents = [];
      const iteratorAgents = [];
      async.auto({
        create: callback => async.times(3, (i, callback) =>
          brLedgerAgent.add(regularActor, null, options, (err, result) => {
            testAgents.push(result.id);
            callback();
          }), callback),
        getIterator: ['create', (results, callback) => {
          const options = {
            owner: regularActor.id
          };
          brLedgerAgent.getAgentIterator(
            regularActor, options, (err, iterator) => {
              should.not.exist(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => {throw err;});
          }, callback);
        }],
        test: ['iterate', (results, callback) => {
          iteratorAgents.should.include.members(testAgents);
          callback();
        }]
      }, done);
    });
    it('should delete their ledger agent', done => async.auto({
      create: callback => {
        const options = {
          configEvent: signedConfigEvent,
          owner: regularActor.id
        };
        brLedgerAgent.add(regularActor, null, options, callback);
      },
      delete: ['create', (results, callback) => {
        const options = {
          owner: regularActor.id
        };
        brLedgerAgent.remove(regularActor, results.create.id, options, err => {
          should.not.exist(err);
          callback();
        });
      }],
      test: ['delete', (results, callback) =>
        database.collections.ledgerAgent.findOne({
          id: database.hash(results.create.id)
        }, (err, result) => {
          should.not.exist(err);
          should.exist(result);
          result.meta.deleted.should.be.a('number');
          callback();
        })]
    }, done));
    it('returns PermissionDenied for unauthorized get', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: adminActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          regularActor, ledgerAgentId, options, (err, ledgerAgent) => {
            should.exist(err);
            should.not.exist(ledgerAgent);
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
    });
    it('returns PermissionDenied for unauthorized delete', done => async.auto({
      create: callback => {
        const options = {
          configEvent: signedConfigEvent,
          owner: adminActor.id
        };
        brLedgerAgent.add(adminActor, null, options, (err, la) => {
          callback(err, la);
        });
      },
      delete: ['create', (results, callback) => {
        const options = {
          configEvent: mockData.events.config,
          owner: adminActor.id
        };
        brLedgerAgent.remove(regularActor, results.create.id, options, err => {
          should.exist(err);
          err.name.should.equal('PermissionDenied');
          callback();
        });
      }]
    }, err => done(err)));
    it('returns PermissionDenied for unauthorized iterate', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: adminActor.id
      };
      const testAgents = [];
      const iteratorAgents = [];
      async.auto({
        create: callback => async.times(3, (i, callback) =>
          brLedgerAgent.add(adminActor, null, options, (err, result) => {
            testAgents.push(result.id);
            callback();
          }), callback),
        getIterator: ['create', (results, callback) => {
          const options = {
            owner: adminActor.id
          };
          brLedgerAgent.getAgentIterator(
            regularActor, options, (err, iterator) => {
              should.not.exist(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => callback(err));
          }, callback);
        }],
        test: ['iterate', (results, callback) => {
          iteratorAgents.should.include.members(testAgents);
          callback();
        }]
      }, err => {
        should.exist(err);
        err.name.should.equal('PermissionDenied');
        done();
      });
    });
  });
  describe('unauthorizedUser as actor', () => {
    let regularActor;
    let unauthorizedActor;
    let signedConfigEvent;
    before(done => {
      async.auto({
        getRegularUser: callback => brIdentity.get(
          null, mockData.identities.regularUser.identity.id, (err, result) => {
            regularActor = result;
            callback(err);
          }),
        getUnauthorizedUser: callback => brIdentity.get(
          null, mockData.identities.unauthorizedUser.identity.id,
          (err, result) => {
            unauthorizedActor = result;
            callback(err);
          }),
        signConfig: callback => jsigs.sign(mockData.events.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfigEvent = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('returns PermissionDenied for unauthorized add', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: unauthorizedActor.id
      };

      brLedgerAgent.add(
        unauthorizedActor, null, options, (err, ledgerAgent) => {
          should.exist(err);
          should.not.exist(ledgerAgent);
          err.name.should.equal('PermissionDenied');
          done();
        });
    });
    it('returns PermissionDenied for unauth\'d add when node exists', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.node.id;
        brLedgerAgent.add(
          unauthorizedActor, ledgerNodeId, options, (err, ledgerAgent) => {
            should.exist(err);
            should.not.exist(ledgerAgent);
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
    });
    it('returns PermissionDenied for unauthorized get', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          unauthorizedActor, ledgerAgentId, options, (err, ledgerAgent) => {
            should.exist(err);
            should.not.exist(ledgerAgent);
            err.name.should.equal('PermissionDenied');
            done();
          });
      });
    });
    it('returns PermissionDenied for unauthorized iterate', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };
      const testAgents = [];
      const iteratorAgents = [];
      async.auto({
        create: callback => async.times(3, (i, callback) =>
          brLedgerAgent.add(regularActor, null, options, (err, result) => {
            testAgents.push(result.id);
            callback();
          }), callback),
        getIterator: ['create', (results, callback) => {
          const options = {
            owner: regularActor.id
          };
          brLedgerAgent.getAgentIterator(
            unauthorizedActor, options, (err, iterator) => {
              should.not.exist(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => callback(err));
          }, callback);
        }]
      }, err => {
        should.exist(err);
        err.name.should.equal('PermissionDenied');
        done();
      });
    });
    it('returns PermissionDenied for unauthorized delete', done => async.auto({
      create: callback => {
        const options = {
          configEvent: signedConfigEvent,
          owner: regularActor.id
        };
        brLedgerAgent.add(regularActor, null, options, callback);
      },
      delete: ['create', (results, callback) => {
        const options = {
          owner: regularActor.id
        };
        brLedgerAgent.remove(
          unauthorizedActor, results.create.id, options, err => {
            callback(err);
          });
      }]
    }, err => {
      should.exist(err);
      err.name.should.equal('PermissionDenied');
      done();
    }));
  });
  describe('adminUser as actor', () => {
    let regularActor;
    let adminActor;
    let signedConfigEvent;
    before(done => {
      async.auto({
        getRegularUser: callback => brIdentity.get(
          null, mockData.identities.regularUser.identity.id, (err, result) => {
            regularActor = result;
            callback(err);
          }),
        getAdminUser: callback => brIdentity.get(
          null, mockData.identities.adminUser.identity.id, (err, result) => {
            adminActor = result;
            callback(err);
          }),
        signConfig: callback => jsigs.sign(mockData.events.config, {
          algorithm: 'LinkedDataSignature2015',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfigEvent = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('should add a ledger agent for a new ledger', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, ledgerAgent) => {
        should.not.exist(err);
        should.exist(ledgerAgent);
        should.exist(ledgerAgent.id);
        should.exist(ledgerAgent.service.ledgerEventService);
        done();
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.node.id;
        brLedgerAgent.add(
          adminActor, ledgerNodeId, options, (err, ledgerAgent) => {
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
    it('should get existing ledger agent', done => {
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        should.not.exist(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          adminActor, ledgerAgentId, options, (err, ledgerAgent) => {
            should.not.exist(err);
            should.exist(ledgerAgent);
            should.exist(ledgerAgent.id);
            should.exist(ledgerAgent.service.ledgerEventService);
            ledgerAgent.id.should.equal(firstLa.id);
            done();
          });
      });
    });
    it('should iterate over their ledger agents', function(done) {
      this.timeout(60000);
      const options = {
        configEvent: signedConfigEvent,
        owner: regularActor.id
      };
      const testAgents = [];
      const iteratorAgents = [];
      async.auto({
        create: callback => async.times(3, (i, callback) =>
          brLedgerAgent.add(adminActor, null, options, (err, result) => {
            testAgents.push(result.id);
            callback();
          }), callback),
        getIterator: ['create', (results, callback) => {
          const options = {
            owner: regularActor.id
          };
          brLedgerAgent.getAgentIterator(
            adminActor, options, (err, iterator) => {
              should.not.exist(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => {throw err;});
          }, callback);
        }],
        test: ['iterate', (results, callback) => {
          iteratorAgents.should.include.members(testAgents);
          callback();
        }]
      }, done);
    });
    it('should delete their ledger agent', done => async.auto({
      create: callback => {
        const options = {
          configEvent: signedConfigEvent,
          owner: regularActor.id
        };
        brLedgerAgent.add(adminActor, null, options, callback);
      },
      delete: ['create', (results, callback) => {
        const options = {
          owner: regularActor.id
        };
        brLedgerAgent.remove(adminActor, results.create.id, options, err => {
          should.not.exist(err);
          callback();
        });
      }],
      test: ['delete', (results, callback) =>
        database.collections.ledgerAgent.findOne({
          id: database.hash(results.create.id)
        }, (err, result) => {
          should.not.exist(err);
          should.exist(result);
          result.meta.deleted.should.be.a('number');
          callback();
        })]
    }, done));
  });
});
