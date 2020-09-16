/*!
 * Copyright (c) 2017-2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';
const jsigs = require('jsonld-signatures');
const {constants} = require('bedrock').config;
const helpers = require('./helpers');

const {
  purposes: {AssertionProofPurpose},
  suites: {RsaSignature2018}
} = jsigs;

const mock = {};
module.exports = mock;

const accounts = mock.accounts = {};
mock.ldDocuments = {};
let userName;
//.account with permission to access its own ledgers
userName = 'regularUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(
  'urn:v1:0a02328e-ba9d-43f8-830c-f05105495d66');
accounts[userName].meta = {sysResourceRole: []};
accounts[userName].meta.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test',
  generateResource: 'id'
});
accounts[userName].publicKey = '-----BEGIN PUBLIC KEY-----\n' +
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqv8gApfU3FhZx1gyKmBU\n' +
    'czZ1Ba3DQbqcGRJiwWz6wrr9E/K0PcpRws/+GPc1znG4cKLdxkdyA2zROUt/lbaM\n' +
    'TU+/kZzRh3ICZZOuo8kJpGqxPDIm7L1lIcBLOWu/UEV2VaWNOENwiQbh61VJlR+k\n' +
    'HK9LhQxYYZT554MYaXzcSRTC/RzHDTAocf+B1go8tawPEixgs93+HHXoLPGypmqn\n' +
    'lBKAjmGMwizbWFccDQqv0yZfAFpdVY2MNKlDSUNMnZyUgBZNpGOGPm9zi9aMFT2d\n' +
    'DrN9fpWMdu0QeZrJrDHzk6TKwtKrBB9xNMuHGYdPxy8Ix0uNmUt0mqt6H5Vhl4O0\n' +
    '0QIDAQAB\n' +
    '-----END PUBLIC KEY-----\n';
accounts[userName].privateKey = '-----BEGIN RSA PRIVATE KEY-----\n' +
    'MIIEpQIBAAKCAQEAqv8gApfU3FhZx1gyKmBUczZ1Ba3DQbqcGRJiwWz6wrr9E/K0\n' +
    'PcpRws/+GPc1znG4cKLdxkdyA2zROUt/lbaMTU+/kZzRh3ICZZOuo8kJpGqxPDIm\n' +
    '7L1lIcBLOWu/UEV2VaWNOENwiQbh61VJlR+kHK9LhQxYYZT554MYaXzcSRTC/RzH\n' +
    'DTAocf+B1go8tawPEixgs93+HHXoLPGypmqnlBKAjmGMwizbWFccDQqv0yZfAFpd\n' +
    'VY2MNKlDSUNMnZyUgBZNpGOGPm9zi9aMFT2dDrN9fpWMdu0QeZrJrDHzk6TKwtKr\n' +
    'BB9xNMuHGYdPxy8Ix0uNmUt0mqt6H5Vhl4O00QIDAQABAoIBAQCpA3yXM42AsY8j\n' +
    'mwgSnJ48NqJaF5L8P7+UhHi6KMZ+fSYydl0zCevge4bzFD3JrNuZ8VD1b57AxejT\n' +
    'Ec2so/9vVxjJi1AK6WR3FA608rumGJLQJd4Vd2ojfxabTeWOKOo642R/LSFpPzVE\n' +
    'T0toqxqiA53IhxhAc2jDLO+PLIvrao0Y8bWWq36tbxsAplrv8Gms6ZRwfKoX5P32\n' +
    'azBpJOqneNdSMRPHky6t2uiYyuPeG9pbuaClkD7Ss9lpH0V1DLQmAAlP9I0Aa06B\n' +
    'a9zPFPb3Ae8F0HO/tsf8gIvrlT38JvLe5VuCS7/LQNCZguyPZuZOXLDmdETfm1FD\n' +
    'q56rCV7VAoGBANmQ7EqDfxmUygTXlqaCQqNzY5pYKItM6RFHc9I+ADBWsLbuKtfP\n' +
    'XUMHQx6PvwCMBpjZkM7doGdzOHb0l3rW8zQONayqQxN9Pjd7K+dkSY6k0SScw46w\n' +
    '0AexDQSM/0ahVAHfXXi1GbKwlonM0nn/7JHz7n/fL9HwV8T3hAGClbPDAoGBAMk0\n' +
    'K5d+Ov55sKW0ZatZ0vTnfBCSrVEfG6FkcyK7uiSsMdWo2/De0VtJF7od2DM5UyP6\n' +
    'Y/DSVk4oPepbug5oGdu8t1Q3jbS61A7i/dssirQC4hEFAtoTGsVfaH8wu4AKyWd7\n' +
    '0rUmSrnyqNr4mfQBjdaXByvWO9rdEfZcZqaSQ4/bAoGAKy/CR7Q8eYZ4Z2eoBtta\n' +
    'gPl5rvyK58PXi8+EJRqbjPzYTSePp5EI8TIy15EvF9uzv4mIXhfOLFrJvYsluoOK\n' +
    'eS3M575QXEEDJZ40g9T7aO48eakIhH2CfdReQiX+0jVZ6Jk/A6PnOvokl6vpp7/u\n' +
    'ZLZoBEf4RRMRSQ7czDPwpWMCgYEAlNWZtWuz+hBMgpcqahF9AprF5ICL4qkvSDjF\n' +
    'Dpltfbk+9/z8DXbVyUANZCi1iFbMUJ3lFfyRySjtfBI0VHnfPvOfbZXWpi1ZtlVl\n' +
    'UZ7mT3ief9aEIIrnT79ezk9fM71G9NzcphHYTyrYi3pAcAZCRM3diSjlh+XmZqY9\n' +
    'bNRfU+cCgYEAoBYwp0PJ1QEp3lSmb+gJiTxfNwIrP+VLkWYzPREpSbghDYjE2DfC\n' +
    'M8pNbVWpnOfT7OlhN3jw8pxHWap6PxNyVT2W/1AHNGKTK/BfFVn3nVGhOgPgH1AO\n' +
    'sObYxm9gpkNkelXejA/trbLe4hg7RWNYzOztbfbZakdVjMNfXnyw+Q0=\n' +
    '-----END RSA PRIVATE KEY-----\n';
accounts[userName].keys = helpers.createKeyPair({
  userName,
  userId: accounts[userName].account.id,
  publicKey: accounts[userName].publicKey,
  privateKey: accounts[userName].privateKey
});
accounts[userName].suite = new RsaSignature2018({
  creator: mock.accounts.regularUser.keys.privateKey.publicKey,
  key: helpers.ldKeyPair({
    publicKeyPem: accounts[userName].publicKey,
    privateKeyPem: accounts[userName].privateKey
  })
});

mock.ldDocuments[accounts[userName].account.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  id: accounts[userName].account.id,
  publicKey: [{
    id: accounts[userName].keys.publicKey.id,
    type: 'RsaVerificationKey2018',
    owner: accounts[userName].account.id,
    publicKeyPem: accounts[userName].keys.publicKey.id
  }]
};
mock.ldDocuments[accounts[userName].keys.publicKey.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  type: 'RsaVerificationKey2018',
  owner: accounts[userName].account.id,
  id: accounts[userName].keys.publicKey.id,
  publicKeyPem: accounts[userName].keys.publicKey.publicKeyPem
};

//.account with permission to access its own ledgers
userName = 'alternateUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(
  'did:v1:09af68f7-fc2b-43ad-b885-28e153db5866');
accounts[userName].meta = {sysResourceRole: []};
accounts[userName].meta.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test',
  generateResource: 'id'
});
accounts[userName].keys = helpers.createKeyPair({
  userName,
  userId: accounts[userName].account.id,
  publicKey: '-----BEGIN PUBLIC KEY-----\n' +
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3QS5rF47pcj7+HZsp8Kq\n' +
    '7z7nx3fulu9mHbAuWUNORNOG2cHLSjNT7pzKV+dQkmcPO0govt4uxfUsrE9xtteu\n' +
    'RKesJS5eXmV5FEcgt6NezdCmdad6TZ9x7o5lHKe8rX7z2/rki7GNll5mzonv5Sr2\n' +
    'dzU/3oKCNdP5Jlb0+rfhrNw8A4HSmyO7jlMBuVgJJ4SiobdfC6rflfY1ci4QQ/Vj\n' +
    'RHmQdAz9H0g35U5IiFbasc/75tSXPY090rB7t/N02HVjbXFfy+U9C+Qhr+8wxXL3\n' +
    'XEO9dkwP8YF60I0st4BpqA34p+790crBwY80Kh/2PGfxxvdvUxu4V6xhMQgXFuIq\n' +
    'rQIDAQAB\n' +
    '-----END PUBLIC KEY-----\n',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
    'MIIEowIBAAKCAQEA3QS5rF47pcj7+HZsp8Kq7z7nx3fulu9mHbAuWUNORNOG2cHL\n' +
    'SjNT7pzKV+dQkmcPO0govt4uxfUsrE9xtteuRKesJS5eXmV5FEcgt6NezdCmdad6\n' +
    'TZ9x7o5lHKe8rX7z2/rki7GNll5mzonv5Sr2dzU/3oKCNdP5Jlb0+rfhrNw8A4HS\n' +
    'myO7jlMBuVgJJ4SiobdfC6rflfY1ci4QQ/VjRHmQdAz9H0g35U5IiFbasc/75tSX\n' +
    'PY090rB7t/N02HVjbXFfy+U9C+Qhr+8wxXL3XEO9dkwP8YF60I0st4BpqA34p+79\n' +
    '0crBwY80Kh/2PGfxxvdvUxu4V6xhMQgXFuIqrQIDAQABAoIBAEMRPwKGKdV58rQH\n' +
    'w5r4oIQu84h85UKZ7MPPhZECsoqCIaaMfxLKFosOuvwHrlRuv5l+oRaiN1FMv7yd\n' +
    '8uTH+BLPSpaRxoMgiahUmSIAijEsQobrRlqtqpX4UchrQf7nyjoTnSyiuVNK3CmK\n' +
    'g+hnrBiqaPItajPJWg5/TqGSEQIx1gtAUIIDXY+LKB3l7H6j68uscInjOgAlmNOn\n' +
    'h7YQzCNL2BfWR4hyTz4+MoOZZjpVmvN8itHyKl/HTWv5PbSnnDPWgx18bcvVItQY\n' +
    'AFAdLX1a6plUd8ysRX++d0F+hO/fxfkiv4cEQi5lAlCPl0qmkdeB2LMTQhFYNQo9\n' +
    's86f1WUCgYEA7sMXR3fY/4ubucgU/w2+tC3hJufbZtaU+1sPfmYgt+FJhJq68QFa\n' +
    '1OyT9Cgu74PM7EwAEmnRd2Ikg3xcjt2H8jEfJUHCPvq/PQ1MRLMpDGckLv2LGov3\n' +
    '7N+KGb+O8FwyIIyqglRPAEvujX1Cpa8pNEvFFb2ob3rI202on5mxF18CgYEA7Pmw\n' +
    'VGYXFOXieTFazCZbezH9YBsCLcWg1NfR0V93KMraHaSj9vHdr5U94RB2Q6uZuD/Q\n' +
    'R5+zvQsTPyHZK9rOVK2a23LhrC4fGtBMVb4BMSVJrTv+XB6EfkZvl1oqQ0OwNSOP\n' +
    'po1vfEXknCag/rQsi25ajH8XSAf++b/2niRCNXMCgYEAoZA8IW1U1l9nCgj9RDXN\n' +
    '1Oiy0XvVODp957SPwG1lOGhnMibt1wWerDRGTdIfKI4cTc2DwvH9/vXXVW4Cx93a\n' +
    'DyX0OGbOBYXxgGOON3KwlSb6Eh4ZUeZi5tPBBHleRQFuHh5xhu174+x9yRp4zdrA\n' +
    'XBXlkDedUYpZfiSHtS/v6KsCgYBlFvqudkKAarSayIAYOICr5B5XQg5C4lyCj3J1\n' +
    'I4lcgHRdUt+TN4g/H6Ye/XvF0E0p+Sbrduggy7mxI8pV1+hO3SQDW1WDssUYFiWK\n' +
    'KhyuD18HpGEUgPw6Nefio9cFjLl9YaclAI6/b71fE2d4X/nknPXJm2meE7MkbUxS\n' +
    'F9uamwKBgEvespz68OHW80psrdIssdIe1JZZmzxScYHt+JKemroZ2M65g73bhCtj\n' +
    'RIMkJvPd/WQ/cg85DNQ4w23QFwjzBZaXA8we9Dx6PQQGt3SNx0RdJw9qNregDNsx\n' +
    '0vMjVanUjnBSpnEmSI4I7o2E8ejxfCZjT053kf47BupJ6nLde+gZ\n' +
    '-----END RSA PRIVATE KEY-----\n'
});
mock.ldDocuments[accounts[userName].account.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  id: accounts[userName].account.id,
  publicKey: [{
    id: accounts[userName].keys.publicKey.id,
    type: 'RsaVerificationKey2018',
    owner: accounts[userName].account.id,
    publicKeyPem: accounts[userName].keys.publicKey.id
  }]
};
mock.ldDocuments[accounts[userName].keys.publicKey.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  type: 'RsaVerificationKey2018',
  owner: accounts[userName].account.id,
  id: accounts[userName].keys.publicKey.id,
  publicKeyPem: accounts[userName].keys.publicKey.publicKeyPem
};
//.account with permission to access its own ledgers
userName = 'gamma';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(
  'did:v1:4306602b-f9a7-417b-8ab3-e1c2230e3484');
accounts[userName].meta = {sysResourceRole: []};
accounts[userName].meta.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test',
  generateResource: 'id'
});
accounts[userName].keys = helpers.createKeyPair({
  userName,
  userId: accounts[userName].account.id,
  publicKey: '-----BEGIN PUBLIC KEY-----\n' +
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqv8gApfU3FhZx1gyKmBU\n' +
    'czZ1Ba3DQbqcGRJiwWz6wrr9E/K0PcpRws/+GPc1znG4cKLdxkdyA2zROUt/lbaM\n' +
    'TU+/kZzRh3ICZZOuo8kJpGqxPDIm7L1lIcBLOWu/UEV2VaWNOENwiQbh61VJlR+k\n' +
    'HK9LhQxYYZT554MYaXzcSRTC/RzHDTAocf+B1go8tawPEixgs93+HHXoLPGypmqn\n' +
    'lBKAjmGMwizbWFccDQqv0yZfAFpdVY2MNKlDSUNMnZyUgBZNpGOGPm9zi9aMFT2d\n' +
    'DrN9fpWMdu0QeZrJrDHzk6TKwtKrBB9xNMuHGYdPxy8Ix0uNmUt0mqt6H5Vhl4O0\n' +
    '0QIDAQAB\n' +
    '-----END PUBLIC KEY-----\n',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
    'MIIEpQIBAAKCAQEAqv8gApfU3FhZx1gyKmBUczZ1Ba3DQbqcGRJiwWz6wrr9E/K0\n' +
    'PcpRws/+GPc1znG4cKLdxkdyA2zROUt/lbaMTU+/kZzRh3ICZZOuo8kJpGqxPDIm\n' +
    '7L1lIcBLOWu/UEV2VaWNOENwiQbh61VJlR+kHK9LhQxYYZT554MYaXzcSRTC/RzH\n' +
    'DTAocf+B1go8tawPEixgs93+HHXoLPGypmqnlBKAjmGMwizbWFccDQqv0yZfAFpd\n' +
    'VY2MNKlDSUNMnZyUgBZNpGOGPm9zi9aMFT2dDrN9fpWMdu0QeZrJrDHzk6TKwtKr\n' +
    'BB9xNMuHGYdPxy8Ix0uNmUt0mqt6H5Vhl4O00QIDAQABAoIBAQCpA3yXM42AsY8j\n' +
    'mwgSnJ48NqJaF5L8P7+UhHi6KMZ+fSYydl0zCevge4bzFD3JrNuZ8VD1b57AxejT\n' +
    'Ec2so/9vVxjJi1AK6WR3FA608rumGJLQJd4Vd2ojfxabTeWOKOo642R/LSFpPzVE\n' +
    'T0toqxqiA53IhxhAc2jDLO+PLIvrao0Y8bWWq36tbxsAplrv8Gms6ZRwfKoX5P32\n' +
    'azBpJOqneNdSMRPHky6t2uiYyuPeG9pbuaClkD7Ss9lpH0V1DLQmAAlP9I0Aa06B\n' +
    'a9zPFPb3Ae8F0HO/tsf8gIvrlT38JvLe5VuCS7/LQNCZguyPZuZOXLDmdETfm1FD\n' +
    'q56rCV7VAoGBANmQ7EqDfxmUygTXlqaCQqNzY5pYKItM6RFHc9I+ADBWsLbuKtfP\n' +
    'XUMHQx6PvwCMBpjZkM7doGdzOHb0l3rW8zQONayqQxN9Pjd7K+dkSY6k0SScw46w\n' +
    '0AexDQSM/0ahVAHfXXi1GbKwlonM0nn/7JHz7n/fL9HwV8T3hAGClbPDAoGBAMk0\n' +
    'K5d+Ov55sKW0ZatZ0vTnfBCSrVEfG6FkcyK7uiSsMdWo2/De0VtJF7od2DM5UyP6\n' +
    'Y/DSVk4oPepbug5oGdu8t1Q3jbS61A7i/dssirQC4hEFAtoTGsVfaH8wu4AKyWd7\n' +
    '0rUmSrnyqNr4mfQBjdaXByvWO9rdEfZcZqaSQ4/bAoGAKy/CR7Q8eYZ4Z2eoBtta\n' +
    'gPl5rvyK58PXi8+EJRqbjPzYTSePp5EI8TIy15EvF9uzv4mIXhfOLFrJvYsluoOK\n' +
    'eS3M575QXEEDJZ40g9T7aO48eakIhH2CfdReQiX+0jVZ6Jk/A6PnOvokl6vpp7/u\n' +
    'ZLZoBEf4RRMRSQ7czDPwpWMCgYEAlNWZtWuz+hBMgpcqahF9AprF5ICL4qkvSDjF\n' +
    'Dpltfbk+9/z8DXbVyUANZCi1iFbMUJ3lFfyRySjtfBI0VHnfPvOfbZXWpi1ZtlVl\n' +
    'UZ7mT3ief9aEIIrnT79ezk9fM71G9NzcphHYTyrYi3pAcAZCRM3diSjlh+XmZqY9\n' +
    'bNRfU+cCgYEAoBYwp0PJ1QEp3lSmb+gJiTxfNwIrP+VLkWYzPREpSbghDYjE2DfC\n' +
    'M8pNbVWpnOfT7OlhN3jw8pxHWap6PxNyVT2W/1AHNGKTK/BfFVn3nVGhOgPgH1AO\n' +
    'sObYxm9gpkNkelXejA/trbLe4hg7RWNYzOztbfbZakdVjMNfXnyw+Q0=\n' +
    '-----END RSA PRIVATE KEY-----\n'
});
mock.ldDocuments[accounts[userName].account.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  id: accounts[userName].account.id,
  publicKey: [{
    id: accounts[userName].keys.publicKey.id,
    type: 'RsaVerificationKey2018',
    owner: accounts[userName].account.id,
    publicKeyPem: accounts[userName].keys.publicKey.id
  }]
};
mock.ldDocuments[accounts[userName].keys.publicKey.id] = {
  '@context': constants.SECURITY_CONTEXT_V2_URL,
  type: 'RsaVerificationKey2018',
  owner: accounts[userName].account.id,
  id: accounts[userName].keys.publicKey.id,
  publicKeyPem: accounts[userName].keys.publicKey.publicKeyPem
};

//.account with no permissions
userName = 'unauthorizedUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(userName);

//.account with admin permission
userName = 'adminUser';
accounts[userName] = {};
accounts[userName].account = helpers.createAccount(userName);
accounts[userName].meta = {sysResourceRole: []};
accounts[userName].meta.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test'
  // generateResource: 'id' -- removing this restriction grants admin privileges
});

// constants
mock.authorizedSignerUrl = accounts.regularUser.keys.publicKey.id;

// all mock keys for all groups
mock.groups = {
  authorized: {
    publicKey: '-----BEGIN PUBLIC KEY-----\n' +
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAskcRISeoOvgQM8KxMEzP\n' +
      'DMSfcw9NKJRvXNoFnxS0j7DcTPvi0zMXKAY5smANZ1iz9jQ43X/EUDNyjaWkiDUr\n' +
      'lpxGxTFq9D+hUnfzPCW6xAprzZaYhvuHun88CmULWeyWLphISk3/3YhRGnywyUfK\n' +
      'AuYYnKo6F+lDPNyPhknlB2uLblE4upqY5OrvlBdey6PV8teyjVSFo+WSTqzH02ne\n' +
      'X0aaIzZ675BWZyBGK5wCq/6vgCOSBqePflPXY2CfwdMVRe4I3FRnqEsKVQtZ2zwi\n' +
      '5j8YSZKNH4+2SrwuGqG/XcZaKCgKNMNDLRErZkdSPGCLM+OoPUOJEKdCvV3zUZYC\n' +
      'mwIDAQAB\n' +
      '-----END PUBLIC KEY-----',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
      'MIIEpQIBAAKCAQEAskcRISeoOvgQM8KxMEzPDMSfcw9NKJRvXNoFnxS0j7DcTPvi\n' +
      '0zMXKAY5smANZ1iz9jQ43X/EUDNyjaWkiDUrlpxGxTFq9D+hUnfzPCW6xAprzZaY\n' +
      'hvuHun88CmULWeyWLphISk3/3YhRGnywyUfKAuYYnKo6F+lDPNyPhknlB2uLblE4\n' +
      'upqY5OrvlBdey6PV8teyjVSFo+WSTqzH02neX0aaIzZ675BWZyBGK5wCq/6vgCOS\n' +
      'BqePflPXY2CfwdMVRe4I3FRnqEsKVQtZ2zwi5j8YSZKNH4+2SrwuGqG/XcZaKCgK\n' +
      'NMNDLRErZkdSPGCLM+OoPUOJEKdCvV3zUZYCmwIDAQABAoIBAQCMdIMhXO4kr2WM\n' +
      'chpJVGpXw91fuDFxBCkMvVRqddSf1JZsLJMTFBBtXyI7z4Mf5fm6wn/+une/PBlH\n' +
      'UbZj/Yf+29bB62I5VpxRreE7hPo1E4TFb51x01+m5jE2e09LJKNZyG5D5FnufkRv\n' +
      'msdpfR7B0+iWHWMxjXyEybxl73f6tEZcsfK/O46rtVsD/e8szyugg6zrrYWX8BA4\n' +
      'sIRHzLvOZIow5eNbkAFfxXbIRLxjxFt2zSFM3a0GjKkU/7Jb8XoNszHc0eFVS79y\n' +
      'PwQDeoqUP7sHLoHqazhFxI1KJftA/9NE6Nw+U/XJvQRyEaJxAGYgXvvRXhVtEN/H\n' +
      '0y4/tbJZAoGBANvph6zmm49ExBXIg5K6JZw/9vM5GdJpmOTglQuLZGYJ9zwcAiqq\n' +
      'U0mVGsJW0uq5VrHyqknc+edBfYD9K76mf0Sn9jG6rLL1fCl8BnLaF21tGVHU2W+Y\n' +
      'ogcYXRkgYgYVl6RhvRqEsMWSEdr0S0z240bOsUB5W1mA601q7PwXfWYPAoGBAM+I\n' +
      'eXxuskg+pCrWjgPke2Rk7PeEXrWPilSMR1ueA5kNCNdAMmxbDqDD7TKmKsyIfEEQ\n' +
      '3VcWLGVY4vj0yW+ptsw+QFlt8PSjCT2z1heJW9AFEA/9ULU0ZpVdgy+ys9/cXSfq\n' +
      'hZC4UQVwL3ODZE+hIU8pEJw1wTEMUvUBlxkOb4a1AoGBAI/6ydWt9lNK1obcjShX\n' +
      'r6ApUOnVjM5yTKQtVegFD2qvQ6ubOt/sPDOE58wtRFJhnh1Ln6pUf1mlSyJUn3tn\n' +
      'TxQIU+wjKEbS6sPOa/puR8BhGZ62GNYzvIGgtfNpfEQ3ht0dEM536bSw+fe80kBF\n' +
      'tG/7i5mG2wQyn9xEEXzLdFKJAoGAQA7rGNp+U0hqmgJyAYeUAtAYSOpl5XryAtjt\n' +
      '6byjdamNUguxxLpykHMJkzmxOkLiv566A3iHqZy/KoM8bigfkXmhmTkTSB/O6WnK\n' +
      'KqeuXE5Dv/u73sLW60HbDW0GkpHNe1Wrdpk+AQS40Nn8q4ub4XhWdTEuebpJHPEp\n' +
      't4U6LYUCgYEAvi38SUMij1zrNMVoslx5VojF961KCY+RNJvv9HmwV/W2XwjF0VGX\n' +
      'luDSMT5bBXHf1kQfB+DJGo2M6it2IOEZQjd9AJdW1baLGwm56AyQNko7HtEczH0n\n' +
      '42EADs/ajTEckTxULdirbEk2rINRwQC5kWMde3fcwAnn6xt3wvOyuwg=\n' +
      '-----END RSA PRIVATE KEY-----'
  },
  unauthorized: { // unauthorized group
    publicKey: '-----BEGIN PUBLIC KEY-----\n' +
      'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlretzNDRSy2Dmr8xywmP\n' +
      '5BCE8LnFhfl7QB+7gsZSVANeoASk7l++JXM0nv/PJMuq9R8arekQ2tEGA53w1TU8\n' +
      'AbgaK1KYHngIU1X6EK9shPEjuy0pZu+63opkkaCD3euCCraogEk8Vhtx6VbCi04g\n' +
      'SGErFpWW6HRO5S3skw8p8+5iV4hZSR2QT/IW65yjBN22MGvOnLCEUEA+MMsbREdL\n' +
      'PwHtSFanDKseejdzTrBguHh6G4BBSswuB/isWYuKM/9/yHB+mNKwuksEcfT4uJjj\n' +
      'aN5LeRfeGrf6mSQ0KT/y/yIExtrLat9apG5EJbSw86++WXyjhR+Bl4wQNcCNYRHC\n' +
      'HwIDAQAB\n' +
      '-----END PUBLIC KEY-----',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\n' +
      'MIIEpAIBAAKCAQEAlretzNDRSy2Dmr8xywmP5BCE8LnFhfl7QB+7gsZSVANeoASk\n' +
      '7l++JXM0nv/PJMuq9R8arekQ2tEGA53w1TU8AbgaK1KYHngIU1X6EK9shPEjuy0p\n' +
      'Zu+63opkkaCD3euCCraogEk8Vhtx6VbCi04gSGErFpWW6HRO5S3skw8p8+5iV4hZ\n' +
      'SR2QT/IW65yjBN22MGvOnLCEUEA+MMsbREdLPwHtSFanDKseejdzTrBguHh6G4BB\n' +
      'SswuB/isWYuKM/9/yHB+mNKwuksEcfT4uJjjaN5LeRfeGrf6mSQ0KT/y/yIExtrL\n' +
      'at9apG5EJbSw86++WXyjhR+Bl4wQNcCNYRHCHwIDAQABAoIBAQCL53byz8foFBi8\n' +
      '9cvf4EFsgBUXbCq5oYtSS+KAk13q1LHqskTzbXaRRu7KxUTgsBpCrZvTYayeojcF\n' +
      '9n+POno4UlAgdOv2JI/946pcAKsogLsdTd/HyLLbTvXp5Glj//BXx5SEePcEKzfD\n' +
      'VSEDtQLsjR41Oai6oPR3cvjOzd2wquAT3+/KsPjhOR/dcBF0+vf7zsr+HjUhWyJB\n' +
      '6aEjAXLQzXnbqrJIQvx5Md9dm8vf8k+/QQ9uMCWbzAZHwzkEbPOQyYvQuN2EDFr0\n' +
      'jVgRUF/HUth/iweAm46iiHukPEAwfF9Qhryr9Fyoch9Y9XFYyfRtHAGI3SBR85C1\n' +
      'u0kY6QaZAoGBAOVuctsE0Qa3ZGP7GKGwYJLYTPy5o0YqQt3ynsfe5/MZXRzjcpC7\n' +
      'sCntTXQimU9iVyNHHvZ9hxgO4pYsBc81e5ciSbios1N/DjmHjj0/N6vZbl4+5+Ws\n' +
      'hzHkqCKJNkfx0gd/O11//6aPXIMbCj7lUnvUSyxWRARY0MAlfpDTacvlAoGBAKgr\n' +
      'vG4b9x1iOhRSMtoz7/Xly6oUIUfcz0lFR/bh4jEdpsFiGUG8WEADe/2IgxM5BrUW\n' +
      'uLvUmROEBLPfijaHXf1WUJll9Y0suFWKFKvzrqZj8Z8Fso5d4CBSUlt9vf8K634F\n' +
      '3vVRl/CopO7xfVZrpwkRGBI23vxDGrl5qqSOjl2zAoGBANcFrXUgzXn69IZTdSFM\n' +
      'OSZGu9h7bs86mlKCqVbuzPnjwoVpkRyeGpsgwN9f8ckZhEsWw6kFuk/M24UcmxE4\n' +
      'sazSQL9ktDRDtqQqLB+wmM9hRvPjBtkU2dvjzcQYTpwcwdeu4Ydeh82lPHHPLMoH\n' +
      'iEdvjkhuTO66AmKigTzgNp4VAoGALDSK7HqnY27ti2fr/BWI7x8/gO6XrPcq+byf\n' +
      'ZRMNTRHZQp4Ru4jRvcnsrsFSixwDWlilqKICtvGN9uY8w4ajuzMULq5xdHGb5shM\n' +
      'FMMSVqSQ39c0j123y2c4RNpxtffd3RuX9u5CvTznVfPemXfkyWpX5HnN9YuCG90S\n' +
      'cP0UCScCgYBXe5AL2398R+/1blgm2cycJvYEmvJb0MtS6ikOd0M5Nci/uOUBCt/1\n' +
      'AIVgd0FgUA4zaQowuAhnMqennYYsvh+rUz7GNpcQQIhGWkmnPTsB6XU70zxnQ7yP\n' +
      'VucJRhKAJ3S9G4KDkhxBO0S3guEQFiDaalh39m+UwUDPsdrmioqaoQ==\n' +
      '-----END RSA PRIVATE KEY-----'
  }
};

const ledgerConfigurations = mock.ledgerConfigurations = {};

ledgerConfigurations.uni = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'UnilateralConsensus2017',
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [accounts.regularUser.account.id],
    minimumSignaturesRequired: 1
  }],
  operationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }],
    approvedSigner: [accounts.regularUser.account.id],
    minimumSignaturesRequired: 1
  }],
  sequence: 0
};

ledgerConfigurations.continuity = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:680f46a4-d466-4d87-bda5-c09535218086',
  consensusMethod: 'Continuity2017',
  electorSelectionMethod: {
    type: 'MostRecentParticipants',
  },
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [accounts.regularUser.account.id],
    minimumSignaturesRequired: 1
  }],
  operationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord', 'UpdateWebLedgerRecord']
    }],
    approvedSigner: [accounts.regularUser.account.id],
    minimumSignaturesRequired: 1
  }],
  sequence: 0,
};

ledgerConfigurations.multisigAlpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'UnilateralConsensus2017',
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [
      accounts.regularUser.account.id,
      accounts.alternateUser.account.id
    ],
    minimumSignaturesRequired: 2
  }],
  operationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }],
    approvedSigner: [
      accounts.regularUser.account.id,
      accounts.alternateUser.account.id
    ],
    minimumSignaturesRequired: 2
  }],
  sequence: 0
};

ledgerConfigurations.multisigBeta = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:7804fdf1-c56d-4006-bb4c-baba9dc0cbfe',
  consensusMethod: 'UnilateralConsensus2017',
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [
      accounts.regularUser.account.id,
      accounts.alternateUser.account.id
    ],
    minimumSignaturesRequired: 2
  }],
  operationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }],
    approvedSigner: [
      accounts.regularUser.account.id,
      accounts.alternateUser.account.id
    ],
    minimumSignaturesRequired: 2
  }],
  sequence: 0
};

ledgerConfigurations.equihash = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfiguration',
  ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
  consensusMethod: 'UnilateralConsensus2017',
  ledgerConfigurationValidator: [{
    type: 'SignatureValidator2017',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['WebLedgerConfiguration']
    }],
    approvedSigner: [
      accounts.regularUser.account.id,
      accounts.alternateUser.account.id
    ],
    minimumSignaturesRequired: 1
  }],
  operationValidator: [{
    type: 'EquihashValidator2018',
    validatorFilter: [{
      type: 'ValidatorFilterByType',
      validatorFilterByType: ['CreateWebLedgerRecord']
    }],
    equihashParameterN: 64,
    equihashParameterK: 3
  }]
};

const events = mock.events = {};
const ops = mock.ops = {};

events.config = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration: ledgerConfigurations.uni
};

events.configContinuity = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration: ledgerConfigurations.continuity
};

events.multisigConfigAlpha = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration: ledgerConfigurations.multisigAlpha
};

events.multisigConfigBeta = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration: ledgerConfigurations.multisigBeta
};

events.equihashConfig = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'WebLedgerConfigurationEvent',
  ledgerConfiguration: ledgerConfigurations.equihash
};

ops.createConcertRecord = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  type: 'CreateWebLedgerRecord',
  record: {
    '@context': constants.TEST_CONTEXT_V1_URL,
    id: 'https://example.com/events/123456',
    type: 'Concert',
    name: 'Big Band Concert in New York City',
    startDate: '2017-07-14T21:30',
    location: 'https://example.org/the-venue',
    offers: {
      type: 'Offer',
      price: '13.00',
      priceCurrency: 'USD',
      url: 'https://www.ticketfly.com/purchase/309433'
    }
  }
};

const blocks = mock.blocks = {};
blocks.config = {
  '@context': constants.WEB_LEDGER_CONTEXT_V1_URL,
  id: '',
  type: 'WebLedgerEventBlock',
  event: [events.config]
};

mock.purpose = new AssertionProofPurpose();

