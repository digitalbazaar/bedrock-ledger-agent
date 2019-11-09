/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const async = require('async');
const bedrock = require('bedrock');
const brIdentity = require('bedrock-identity');
const brLedgerAgent = require('bedrock-ledger-agent');
const database = require('bedrock-mongodb');
const {documentLoader} = require('bedrock-jsonld-document-loader');
const helpers = require('./helpers');
const jsigs = require('jsonld-signatures');
const mockData = require('./mock.data');
const {util: {uuid}} = bedrock;

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
    let signedConfig;
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
        signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfig = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('should add a ledger agent for a new ledger', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        assertNoError(err);
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
        ledgerConfiguration: signedConfig,
        owner: regularActor.id,
        name: uuid(),
        description: uuid()
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        assertNoError(err);
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
        ledgerConfiguration: mockData.ledgerConfigurations.uni,
        owner: regularActor.id
      };
      brLedgerAgent.add(regularActor, null, options, (err, ledgerAgent) => {
        should.exist(err);
        should.not.exist(ledgerAgent);
        err.name.should.equal('ValidationError');
        err.details.validatorReports[0].error.message.should.equal(
          'An error occurred during signature verification.');
        done();
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.ledgerNode.id;
        brLedgerAgent.add(
          regularActor, ledgerNodeId, options, (err, ledgerAgent) => {
            assertNoError(err);
            should.exist(ledgerAgent);
            should.exist(ledgerAgent.id);
            should.exist(ledgerAgent.service.ledgerEventService);
            ledgerAgent.id.should.not.equal(firstLa.id);
            ledgerAgent.ledgerNode.id.should.equal(ledgerNodeId);
            done();
          });
      });
    });
    it('should get existing ledger agent', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          regularActor, ledgerAgentId, options, (err, ledgerAgent) => {
            assertNoError(err);
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
        ledgerConfiguration: signedConfig,
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
              assertNoError(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => {
              throw err;
            });
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
          ledgerConfiguration: signedConfig,
          owner: regularActor.id
        };
        brLedgerAgent.add(regularActor, null, options, callback);
      },
      delete: ['create', (results, callback) => {
        const options = {
          owner: regularActor.id
        };
        brLedgerAgent.remove(regularActor, results.create.id, options, err => {
          assertNoError(err);
          callback();
        });
      }],
      test: ['delete', (results, callback) =>
        database.collections.ledgerAgent.findOne({
          id: database.hash(results.create.id)
        }, (err, result) => {
          assertNoError(err);
          should.exist(result);
          result.meta.deleted.should.be.a('number');
          callback();
        })]
    }, done));
    it('returns PermissionDenied for unauthorized get', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: adminActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        assertNoError(err);

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
          ledgerConfiguration: signedConfig,
          owner: adminActor.id
        };
        brLedgerAgent.add(adminActor, null, options, (err, la) => {
          callback(err, la);
        });
      },
      delete: ['create', (results, callback) => {
        const options = {
          ledgerConfiguration: mockData.ledgerConfigurations.uni,
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
        ledgerConfiguration: signedConfig,
        owner: adminActor.id
      };
      const testAgents = [];
      const iteratorAgents = [];
      async.auto({
        create: callback => async.times(3, (i, callback) =>
          brLedgerAgent.add(adminActor, null, options, (err, result) => {
            assertNoError(err);
            testAgents.push(result.id);
            callback();
          }), callback),
        getIterator: ['create', (results, callback) => {
          const options = {
            owner: adminActor.id
          };
          brLedgerAgent.getAgentIterator(
            regularActor, options, (err, iterator) => {
              assertNoError(err);
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
    let signedConfig;
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
        signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfig = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('returns PermissionDenied for unauthorized add', done => {
      const options = {
        ledgerConfiguration: signedConfig,
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
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.ledgerNode.id;
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
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        assertNoError(err);

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
        ledgerConfiguration: signedConfig,
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
              assertNoError(err);
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
          ledgerConfiguration: signedConfig,
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
    it('should get public ledger agent', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id,
        public: true
      };

      brLedgerAgent.add(regularActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {public: true};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          unauthorizedActor, ledgerAgentId, options, (err, ledgerAgent) => {
            assertNoError(err);
            should.exist(ledgerAgent);
            should.exist(ledgerAgent.id);
            should.exist(ledgerAgent.service.ledgerEventService);
            ledgerAgent.id.should.equal(firstLa.id);
            done();
          });
      });
    });
    it('should iterate over public ledger agents', function(done) {
      this.timeout(60000);
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id,
        public: true
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
            public: true
          };
          brLedgerAgent.getAgentIterator(
            unauthorizedActor, options, (err, iterator) => {
              assertNoError(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => {
              throw err;
            });
          }, callback);
        }],
        test: ['iterate', (results, callback) => {
          iteratorAgents.should.include.members(testAgents);
          callback();
        }]
      }, done);
    });
  });
  describe('adminUser as actor', () => {
    let regularActor;
    let adminActor;
    let signedConfig;
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
        signConfig: callback => jsigs.sign(mockData.ledgerConfigurations.uni, {
          documentLoader,
          algorithm: 'RsaSignature2018',
          privateKeyPem:
            mockData.identities.regularUser.keys.privateKey.privateKeyPem,
          creator: mockData.identities.regularUser.keys.privateKey.publicKey
        }, (err, result) => {
          signedConfig = result;
          callback(err);
        })
      }, err => done(err));
    });
    it('should add a ledger agent for a new ledger', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, ledgerAgent) => {
        assertNoError(err);
        should.exist(ledgerAgent);
        should.exist(ledgerAgent.id);
        should.exist(ledgerAgent.service.ledgerEventService);
        done();
      });
    });
    it('should add a ledger agent for an existing ledger node', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {
          owner: regularActor.id
        };
        const ledgerNodeId = firstLa.ledgerNode.id;
        brLedgerAgent.add(
          adminActor, ledgerNodeId, options, (err, ledgerAgent) => {
            assertNoError(err);
            should.exist(ledgerAgent);
            should.exist(ledgerAgent.id);
            should.exist(ledgerAgent.service.ledgerEventService);
            ledgerAgent.id.should.not.equal(firstLa.id);
            ledgerAgent.ledgerNode.id.should.equal(ledgerNodeId);
            done();
          });
      });
    });
    it('should get existing ledger agent', done => {
      const options = {
        ledgerConfiguration: signedConfig,
        owner: regularActor.id
      };

      brLedgerAgent.add(adminActor, null, options, (err, firstLa) => {
        assertNoError(err);

        const options = {};
        const ledgerAgentId = firstLa.id;
        brLedgerAgent.get(
          adminActor, ledgerAgentId, options, (err, ledgerAgent) => {
            assertNoError(err);
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
        ledgerConfiguration: signedConfig,
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
              assertNoError(err);
              callback(null, iterator);
            });
        }],
        iterate: ['getIterator', (results, callback) => {
          async.eachSeries(results.getIterator, (promise, callback) => {
            promise.then(ledgerAgent => {
              iteratorAgents.push(ledgerAgent.id);
              callback();
            }).catch(err => {
              throw err;
            });
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
          ledgerConfiguration: signedConfig,
          owner: regularActor.id
        };
        brLedgerAgent.add(adminActor, null, options, callback);
      },
      delete: ['create', (results, callback) => {
        const options = {
          owner: regularActor.id
        };
        brLedgerAgent.remove(adminActor, results.create.id, options, err => {
          assertNoError(err);
          callback();
        });
      }],
      test: ['delete', (results, callback) =>
        database.collections.ledgerAgent.findOne({
          id: database.hash(results.create.id)
        }, (err, result) => {
          assertNoError(err);
          should.exist(result);
          result.meta.deleted.should.be.a('number');
          callback();
        })]
    }, done));
  });
});
