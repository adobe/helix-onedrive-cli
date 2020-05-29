/*
 * Copyright 2020 Adobe. All rights reserved.
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

const chalk = require('chalk');

const {
  loadState, getOneDriveClient,
} = require('../../client.js');

function getDriveItem(url) {
  // todo: parse better
  const [, , driveId, , id] = url.split('/');
  return {
    id,
    parentReference: {
      driveId,
    },
  };
}

async function handler(args) {
  const { sheet, name, value } = args;
  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }

  const od = getOneDriveClient();
  const driveItem = getDriveItem(state.root);
  let container = await od.getWorkbook(driveItem);
  if (sheet) {
    container = container.worksheet(sheet);
  }
  await container.addNamedItem(name, value);
}

Object.assign(exports, {
  command: 'add <name> <value>',
  desc: 'add a named item to a work book or work sheet',
  alias: 'add',
  handler: (y) => handler(y),
});
