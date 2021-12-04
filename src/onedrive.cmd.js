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
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadCommands } from './utils.js';
import onedrive from './onedrive.js';

export default async function install(yargs) {
  yargs
    .command({
      command: 'me',
      desc: 'Show information about the logged in user.',
      handler: onedrive.me,
    })
    .command({
      command: 'login',
      desc: 'Start the login interactive flow or ROPC flow with username / password.',
      builder: (y) => y
        .option('username', {
          alias: 'u',
          type: 'string',
          description: 'Username for ROPC flow.',
        }).option('password', {
          alias: 'p',
          type: 'string',
          description: 'Password for ROPC flow.',
        }),
      handler: (y) => onedrive.login(y.username, y.password),
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
          command: 'create <owner> <repo> <ref> <client-state>',
          desc: 'create a subscription.',
          handler: onedrive.createSubscription,
          builder: (z) => z
            .option('target', {
              type: 'string',
              description: 'Target cloud, possible values are AWS and Runtime',
              default: 'aws',
            })
            .option('aws-region', {
              type: 'string',
              description: 'AWS region to use',
              default: 'us-east-1',
            })
            .option('aws-api', {
              type: 'string',
              description: 'AWS API gateway to use',
            })
            .option('action-version', {
              type: 'string',
              description: 'Action version to use',
              default: 'v1',
            }),
        })
        .command({
          command: 'refresh <id>',
          desc: 'refresh a subscription.',
          handler: onedrive.refreshSubscription,
        })
        .command({
          command: ['delete <id>', 'rm'],
          desc: 'delete a subscription.',
          handler: onedrive.deleteSubscription,
        }),
    })
    .command({
      command: 'poll',
      desc: 'continuously polls for changes in a drive.',
      handler: onedrive.poll,
      builder: (y) => y.option('skip', {
        alias: 's',
        type: 'boolean',
        description: 'Skip initial building of path hierarchy',
        default: false,
      }),
    });
  await loadCommands(yargs, resolve(fileURLToPath(import.meta.url), '..', 'excel'));
  return yargs;
}
