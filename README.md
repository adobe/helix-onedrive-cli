# Helix OneDrive CLI

> Project Helix OneDrive Command Line Interface Utility

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-onedrive-cli.svg)](https://codecov.io/gh/adobe/helix-onedrive-cli)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-onedrive-cli.svg)](https://circleci.com/gh/adobe/helix-onedrive-cli)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-onedrive-cli.svg)](https://github.com/adobe/helix-onedrive-cli/blob/master/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/adobe/helix-onedrive-cli.svg)](https://github.com/adobe/helix-onedrive-cli/issues)
[![LGTM Code Quality Grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/adobe/helix-onedrive-cli.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/adobe/helix-onedrive-cli)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Installation

```bash
$ npm install @adobe/helix-onedrive-cli
```

## Usage

```
Usage: 1d <command>

Commands:
  1d me                   Show information about the logged in user.
  1d resolve <link>       Resolves a share link to the respective drive item.
  1d ls [path]            Lists the contents of the [path]
  1d get <path> [local]   downloads the file at path
  1d put <local> [path]]  upload the local file.

Options:
  --version      Show version number                                                                                                                                                                      [boolean]
  --verbose, -v  Run with verbose logging                                                                                                                                                                 [boolean]
  --help         Show help
```

## Setup

The 1d client needs a `.env` file containing the azure client-id and client-secret of an app (currently the id-token authentication is not supported). for example:

```
$ cat .env
# azure app oauth secrets
AZURE_APP_CLIENT_ID="11111111-1111-1111-1111-11111111111"
AZURE_APP_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

After the `.env` is setup, start the _dev server_ with:

```
npm start
```

and open a browser at: http://localhost:4502/.

click on the link to login. after successful login to microsoft, the server writes a `.auth.json` on disk.
After that you can stop the server, and use the cli, eg:

```
$ 1d me
Logged in as: John Doe (john@example.com) 
```

To reset authentication, just delete the `.auth.json` file and open the browser in private mode.

## Development

### Build

```bash
$ npm install
```

### Test

```bash
$ npm test
```

### Lint

```bash
$ npm run lint
```
