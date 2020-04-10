/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

'use strict';

const onedrive = require('./onedrive.js');

function install(yargs) {
  return yargs
    .command({
      command: 'me',
      desc: 'Show information about the logged in user.',
      handler: onedrive.me,
    })
    .command({
      command: 'login',
      desc: 'Start the login interactive flow.',
      handler: onedrive.login,
    })
    .command({
      command: 'logout',
      desc: 'Logout be removing the authorization file.',
      handler: onedrive.logout,
    })
    .command({
      command: 'resolve <link>',
      desc: 'Resolves a share link to the respective drive item.',
      handler: onedrive.resolve,
    })
    .command({
      command: 'ls [path]',
      desc: 'Lists the contents of the [path]',
      handler: onedrive.ls,
    })
    .command({
      command: 'get <path> [local]',
      desc: 'downloads the file at path',
      handler: onedrive.download,
      builder: (y) => y.option('recursive', {
        alias: 'r',
        type: 'boolean',
        description: 'Download recursively',
      }),
    })
    .command({
      command: 'put <local> [path]]',
      desc: 'upload the local file.',
      handler: onedrive.upload,
    })
    .command({
      command: ['subscriptions', 'sub'],
      desc: 'list, create, refresh or delete subscriptions.',
      handler: () => yargs.showHelp(),
      builder: (y) => y
        .command({
          command: ['list', 'ls'],
          desc: 'list subscriptions.',
          handler: onedrive.listSubscriptions,
        })
        .command({
          command: 'create <resource> <url> <clientstate>',
          desc: 'create subscriptions.',
          handler: onedrive.createSubscription,
        })
        .command({
          command: 'refresh <id>',
          desc: 'refresh subscription.',
          handler: onedrive.refreshSubscription,
        })
        .command({
          command: 'delete <id>',
          desc: 'delete subscription.',
          handler: onedrive.deleteSubscription,
        }),
    })
    .command({
      command: 'poll',
      desc: 'continuously polls for changes in a drive.',
      handler: onedrive.poll,
    });
}

module.exports = install;
