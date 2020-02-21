# bedrock-ledger-agent ChangeLog

## 3.1.0 - TBD

### Added
- Add support for `bedrock-accounts` with private ledger agents.

### Fixed
- Correct owner calculation with private ledger agents.

## 3.0.0 - 2020-06-18

### Added
- Setup CI workflow.

### Changed
- **BREAKING**: Remove `bedrock-docs` dependency and RAML documentation.

## 2.3.2 - 2019-12-17

### Changed
- Update peer dependencies.

## 2.3.1 - 2019-11-13

### Changed
- Update peer dependencies.

## 2.3.0 - 2019-11-08

### Changed
- Update for latest bedrock events API.
- Changed mongo index & collection creation to work with latest `bedrock-mongodb`.

### Removed
- Removed all instances of `bedrock-identity` in favor of account.

### Fixed
- Change owners calculation to handle account system.

## 2.2.0 - 2019-03-25

### Changed
- Use bedrock-ledger-node@8.

## 2.1.0 - 2018-12-31

### Added
- Expose `targetNode` to be used for pinning operations to a specific ledger
  node.

## 2.0.0 - 2018-09-20

### Changed
- Update to bedrock-validation 3.x.

## 1.0.0 - 2018-09-11

- See git history for changes previous to this release.
