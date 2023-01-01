# Helix OneDrive CLI

> Project Helix OneDrive Command Line Interface Utility

## Status
[![codecov](https://img.shields.io/codecov/c/github/adobe/helix-onedrive-cli.svg)](https://codecov.io/gh/adobe/helix-onedrive-cli)
[![CircleCI](https://img.shields.io/circleci/project/github/adobe/helix-onedrive-cli.svg)](https://circleci.com/gh/adobe/helix-onedrive-cli)
[![GitHub license](https://img.shields.io/github/license/adobe/helix-onedrive-cli.svg)](https://github.com/adobe/helix-onedrive-cli/blob/main/LICENSE.txt)
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
  1d login                Start the login interactive flow or ROPC flow with username / password.
  1d logout               Logout be removing the authorization file.
  1d resolve <link>       Resolves a share link to the respective drive item.
  1d ls [path]            Lists the contents of the [path]
  1d get <path> [local]   downloads the file at path
  1d put <local> [path]]  upload the local file.

Options:
  --version      Show version number
  --verbose, -v  Run with verbose logging
  --help         Show help
```

## Setup

The 1d client runs with a default client id which supports interactive login. Just run
`1d login`, copy paste the authorization code in the browser and sing into microsoft.

If you want to run the client with different parameters, you can provide
a `.env` file containing the azure client-id and client-secret of your app.

```dotenv
# azure app oauth secrets
AZURE_APP_CLIENT_ID="11111111-1111-1111-1111-11111111111"
AZURE_APP_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

After the `.env` is setup, start the _dev server_ with:

```console
$ npm start
```

and open a browser at: http://localhost:4502/.

click on the link to login. after successful login to microsoft, the server writes a `.auth.json` on disk.
After that you can stop the server, and use the cli, eg:

```console
$ 1d me
Logged in as: John Doe (john@example.com)
```

To reset authentication, just delete the `.auth.json` file and open the browser in private mode.

### Login with device token

In order to login with a device token, run:

```console
$ 1d login
To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code HNGP5CAF8 to authenticate.
updated .auth.json file.
$ 1d me
Logged in as: John Doe (john@doe.com)
```

### Login with username / password

Some accounts and apps allow login with username and password (ROPC flow). Usually federated accounts require MFA,
which disallow using ROPC.

```console
$ 1d login --username=john@doe.com
password: ****
updated .auth.json file.
Logged in as: John Doe (john@doe.com)
```

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
test
h
