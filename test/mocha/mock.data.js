/*
 * Copyright (c) 2017 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const helpers = require('./helpers');

const mock = {};
module.exports = mock;

const identities = mock.identities = {};
mock.ldDocuments = {};
let userName;

// identity with permission to access its own ledgers
userName = 'regularUser';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);
identities[userName].identity.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test',
  generateResource: 'id'
});
identities[userName].keys = helpers.createKeyPair({
  userName: userName,
  userId: identities[userName].identity.id,
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
mock.ldDocuments[identities[userName].identity.id] = {
  "@context": "https://w3id.org/identity/v1",
  "id": identities[userName].identity.id,
  "publicKey": [{
    "id": mock.authorizedSignerUrl,
    "type": "CryptographicKey",
    "owner": identities[userName].identity.id,
    "publicKeyPem": identities[userName].keys.publicKey.id
  }]
};
mock.ldDocuments[identities[userName].keys.publicKey.id] = {
  "@context": "https://w3id.org/identity/v1",
  "type": "CryptographicKey",
  "owner": identities[userName].identity.id,
  "label": "Signing Key for " + identities[userName].identity.id,
  "id": identities[userName].keys.publicKey.id,
  "publicKeyPem": identities[userName].keys.publicKey.publicKeyPem
};

// identity with permission to access its own ledgers
userName = 'alternateUser';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);
identities[userName].identity.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test',
  generateResource: 'id'
});
identities[userName].keys = helpers.createKeyPair({
  userName: userName,
  userId: identities[userName].identity.id,
  publicKey: '-----BEGIN PUBLIC KEY-----\n' +
    'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDWn5TYzA1AksoTvwZOk2KxGB4f\n' +
    'HHAn38sBIPkT0hqLB0gyP1HVcl/hFa3s0nPXcCUWxwOIxljSF6SMOqTfpOXAIzIX\n' +
    'S02GS00aS3rzOmxpY01ptq1WRBVCCAK4nyJHD7JkkN0EZ8zM3GXHWzO/H8oYS8tE\n' +
    'dGXOPEHfDCNLuBXctQIDAQAB\n' +
    '-----END PUBLIC KEY-----\n',
  privateKey: '-----BEGIN PRIVATE KEY-----\n' +
    'MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBANaflNjMDUCSyhO/\n' +
    'Bk6TYrEYHh8ccCffywEg+RPSGosHSDI/UdVyX+EVrezSc9dwJRbHA4jGWNIXpIw6\n' +
    'pN+k5cAjMhdLTYZLTRpLevM6bGljTWm2rVZEFUIIArifIkcPsmSQ3QRnzMzcZcdb\n' +
    'M78fyhhLy0R0Zc48Qd8MI0u4Fdy1AgMBAAECgYBd5knYJEZ0BwT0aLIYtLEMLDIZ\n' +
    'iHala2tE3ik7e8PzKcdzfHKQQU8jijmjEFxwWHdRpNauA6GeoYtzcsDpvBpsDU26\n' +
    '0w6lDSqfN1PUhcnCo6BOs/wFsUwOiMpDlxcCdLp5KfjS1b+9EVIhGB28lJ6UMtW4\n' +
    'kUQ62q+y43fzleqNrQJBAPfDppld16ZeuEN2ewG5jZ8xJI830pxZDzMA7NBlUpFz\n' +
    'qgNjRcjRE4ZPkfGXxuTPpfB/UNVqxSDUECLDUMTpYfsCQQDdwesV5twwYnSxG/82\n' +
    'FIVYkex+cMtK7+LBgCU9IXSiRW0GSvrokJz/WNGVXkBU8v5Eh8R0AHQ2F7wUltEx\n' +
    'kC0PAkEA9R8mBfmnzrtLRcNEMxKmoGZ4KxEpVvFtbiJuKEb2B10NSMjAU8s1q92x\n' +
    'H/nvFpSxMVxkVqCJYs8rH5looUfcXQJBALaOrbmaFCrA4s/q/G7I9f20I7zznmhS\n' +
    'k5o4pG9u21W7UcWcdHKAmr6bn+4XaV6FrE0+d7wHo6PkZjGM9yqWRoECQQCr88fX\n' +
    'OKN20B8ci/1Kc2fiHb97DPHSwzm9fVySNcGQIbx640+tdXQVw/BhtlZLo5HZfZEz\n' +
    'uOhRrGhuLsnnaamp\n' +
    '-----END PRIVATE KEY-----\n'
});
mock.ldDocuments[identities[userName].identity.id] = {
  "@context": "https://w3id.org/identity/v1",
  "id": identities[userName].identity.id,
  "publicKey": [{
    "id": mock.authorizedSignerUrl,
    "type": "CryptographicKey",
    "owner": identities[userName].identity.id,
    "publicKeyPem": identities[userName].keys.publicKey.id
  }]
};
mock.ldDocuments[identities[userName].keys.publicKey.id] = {
  "@context": "https://w3id.org/identity/v1",
  "type": "CryptographicKey",
  "owner": identities[userName].identity.id,
  "label": "Signing Key for " + identities[userName].identity.id,
  "id": identities[userName].keys.publicKey.id,
  "publicKeyPem": identities[userName].keys.publicKey.publicKeyPem
};

// identity with no permissions
userName = 'unauthorizedUser';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);

// identity with admin permission
userName = 'adminUser';
identities[userName] = {};
identities[userName].identity = helpers.createIdentity(userName);
identities[userName].identity.sysResourceRole.push({
  sysRole: 'bedrock-ledger-agent.test'
  // generateResource: 'id' -- removing this restriction grants admin privileges
});

// constants
mock.authorizedSignerUrl = identities.regularUser.keys.publicKey.id;

// all mock keys for all groups
mock.groups = {
  'authorized': {
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
  'unauthorized': { // unauthorized group
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

const events = mock.events = {};

events.config = {
  '@context': 'https://w3id.org/webledger/v1',
  type: 'WebLedgerConfigurationEvent',
  operation: 'Config',
  input: [{
    type: 'WebLedgerConfiguration',
    ledger: 'did:v1:eb8c22dc-bde6-4315-92e2-59bd3f3c7d59',
    consensusMethod: {
      type: 'UnilateralConsensus2017'
    },
    eventGuard: [{
      type: 'ProofOfSignature2017',
      supportedEventType: 'WebLedgerEvent',
      approvedSigner: [mock.authorizedSignerUrl],
      minimumSignaturesRequired: 1
    }, {
      type: 'ProofOfSignature2017',
      supportedEventType: 'WebLedgerConfigurationEvent',
      approvedSigner: [mock.authorizedSignerUrl],
      minimumSignaturesRequired: 1
    }]
  }]
};

events.concert = {
  '@context': 'https://w3id.org/webledger/v1',
  type: 'WebLedgerEvent',
  operation: 'Create',
  input: [{
    '@context': 'https://w3id.org/test/v1',
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
  }]
};

const blocks = mock.blocks = {};
blocks.config = {
  '@context': 'https://w3id.org/webledger/v1',
  id: '',
  type: 'WebLedgerEventBlock',
  event: [events.config]
};

const bedrock = require('bedrock');
const jsonld = bedrock.jsonld;
const oldLoader = jsonld.documentLoader;
jsonld.documentLoader = function(url, callback) {
  if(Object.keys(mock.ldDocuments).includes(url)) {
    return callback(null, {
      contextUrl: null,
      document: mock.ldDocuments[url],
      documentUrl: url
    });
  }
  // const regex = new RegExp(
  //   'http://authorization.dev/dids' + '/(.*?)$');
  // const didMatch = url.match(regex);
  // if(didMatch && didMatch.length === 2 && didMatch[1] in mock.didDocuments) {
  //   return callback(null, {
  //     contextUrl: null,
  //     document: mock.didDocuments[didMatch[1]],
  //     documentUrl: url
  //   });
  // }
  oldLoader(url, callback);
};
