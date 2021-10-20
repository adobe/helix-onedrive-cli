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
const { info } = require('../../logging.js');

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
  const { sheet, name } = args;
  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }

  const od = await getOneDriveClient();
  const driveItem = getDriveItem(state.root);
  let container = await od.getWorkbook(driveItem);
  if (sheet) {
    container = container.worksheet(sheet);
  }
  if (name) {
    const {
      value, comment,
    } = await container.getNamedItem(name);
    info(chalk`    Value: {yellow ${value}}`);
    info(chalk`  Comment: {yellow ${comment}}\n`);
  } else {
    const namedItems = await container.getNamedItems();
    namedItems
      .forEach((item) => {
        const {
          name: n, value, comment,
        } = item;
        info(chalk`     Name: {yellow ${n}}`);
        info(chalk`    Value: {yellow ${value}}`);
        info(chalk`  Comment: {yellow ${comment}}\n`);
      });
  }
}

Object.assign(exports, {
  command: ['list [name]', 'ls'],
  desc: 'List all names in a work book or work sheet',
  handler: (y) => handler(y),
});
