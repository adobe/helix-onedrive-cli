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
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const openBrowser = require('open');
const { OneDrive } = require('@adobe/helix-onedrive-support');
const { info, debug, SimpleInterface } = require('@adobe/helix-log');

const STATE_FILE = '.hlx-1d.json';
const AUTH_FILE = '.auth.json';
const DEFAULT_CLIENT_ID = 'f4c79ff7-bbd2-4b36-822e-a89eb6de4578';

let state = {};
async function loadState() {
  try {
    state = await fs.readJson(STATE_FILE);
  } catch {
    // ignore
  }
}
async function saveState() {
  await fs.writeJson(STATE_FILE, state);
}

let client = null;

function getOneDriveClient() {
  if (client) {
    return client;
  }
  const {
    AZURE_APP_CLIENT_ID: clientId = DEFAULT_CLIENT_ID,
    AZURE_APP_CLIENT_SECRET: clientSecret = '',
    AZURE_APP_REFRESH_TOKEN: refreshToken = '',
    AZURE_APP_TENANT: tenant = '',
  } = process.env;

  if (!clientId) {
    info(chalk`{red error:} Missing clientId and/or client secret environment.`);
    info(chalk`Suggest to create a {yellow .env} file with:\n`);
    info(chalk`AZURE_APP_CLIENT_ID={gray <client-id of the app>}`);
    info(chalk`AZURE_APP_CLIENT_SECRET={gray <client-secret of the app>}`);
    process.exit(-1);
  }
  let tokens = {};
  try {
    tokens = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  } catch (e) {
    // ignore
  }

  const {
    accessToken,
    expiresOn,
  } = tokens;

  client = new OneDrive({
    clientId,
    clientSecret,
    refreshToken: refreshToken || tokens.refreshToken,
    tenant,
    accessToken,
    expiresOn,
    log: new SimpleInterface({ level: 'trace' }),
  });
  // register event handle to write back tokens.
  client.on('tokens', (newTokens) => {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(newTokens, null, 2), 'utf-8');
    info(`updated ${AUTH_FILE} file.`);
  });
  return client;
}

async function login() {
  const od = getOneDriveClient();
  if (await od.getAccessToken(false)) {
    info('already logged in.');
    return;
  }
  await od.login(async (code) => {
    await openBrowser(code.verificationUrl);
  });
}

async function logout() {
  // for now, we just delete the .auth.json
  await fs.remove(AUTH_FILE);
}

async function me() {
  const od = getOneDriveClient();
  const result = await od.me();
  info(chalk`Logged in as: {yellow ${result.displayName}} {grey (${result.mail})}`);
}

async function resolve(args) {
  const od = getOneDriveClient();
  const { link } = args;
  const result = link.startsWith('/drives/')
    ? await od.getDriveRootItem(link.split('/')[2])
    : await od.getDriveItemFromShareLink(link);
  const { id, name, webUrl } = result;
  const { driveId } = result.parentReference;
  const canonicalPath = `/drives/${driveId}/items/${id}`;
  info(chalk`   Name: {yellow ${name}}`);
  info(chalk`     Id: {yellow ${id}}`);
  info(chalk`    URL: {yellow ${webUrl}}`);
  info(chalk`DriveId: {yellow ${driveId}}`);
  state.root = canonicalPath;
  state.cwd = '/';
  await saveState();
  info(chalk`\nroot path updated: {yellow ${canonicalPath}}`);
}

async function getDriveItem(url) {
  // todo: parse better
  const [, , driveId, , id] = url.split('/');
  return {
    id,
    parentReference: {
      driveId,
    },
  };
}

async function ls(args) {
  await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  if (args.path && args.path.startsWith('https://')) {
    throw Error(chalk`${args._[0]} does not work on share links directly. use '{grey ${args.$0} resolve}' to set root.`);
  }
  const p = path.posix.join(state.cwd, args.path || '');
  const driveItem = await getDriveItem(state.root);
  // console.log(driveItem);
  const od = getOneDriveClient();
  const result = await od.listChildren(driveItem, p);
  result.value.forEach((item) => {
    let itemPath = path.posix.join(p, item.name);
    if (item.folder) {
      itemPath += '/';
    }
    process.stdout.write(`${itemPath}\n`);
  });
  // console.log(result);
}

async function processQueue(queue, fn, maxConcurrent = 8) {
  const running = [];
  while (queue.length || running.length) {
    if (running.length < maxConcurrent && queue.length) {
      const task = fn(queue.shift(), queue);
      running.push(task);
      task.finally(() => {
        const idx = running.indexOf(task);
        if (idx >= 0) {
          running.splice(idx, 1);
        }
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await Promise.race(running);
    }
  }
}

async function downloadHandler({
  od, dir, dirPath, driveItem,
}, queue) {
  // console.log(driveItem);
  const dst = path.resolve(dir, driveItem.name);
  const relPath = path.posix.join(dirPath, driveItem.name);
  if (driveItem.file) {
    debug(`saving ${driveItem.webUrl} to ${path.relative('.', dst)}`);
    const result = await od.downloadDriveItem(driveItem);
    await fs.ensureDir(dir);
    await fs.writeFile(dst, result);
    const size = (result.length / 1024).toFixed(2);
    info(`${size.padStart(5, ' ')}kb - ${path.relative('.', dst)}`);
    await fs.writeJson(`${dst}.json`, {
      url: driveItem.webUrl,
      driveId: driveItem.parentReference.driveId,
      it: driveItem.id,
      relPath,
    });
  } else if (driveItem.folder) {
    const result = await od.listChildren(driveItem);
    for (const childItem of result.value) {
      queue.push({
        od, dir: dst, dirPath: relPath, driveItem: childItem,
      });
    }
  }
}

async function downloadRecursively(od, dir, dirPath, driveItem) {
  return processQueue([{
    od, dir, dirPath, driveItem,
  }], downloadHandler);
}

async function download(args) {
  await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  const p = path.posix.join(state.cwd, args.path);

  let dst = path.resolve('.', path.posix.basename(p));
  if (args.local) {
    if (await fs.pathExists(args.local) && fs.lstatSync(args.local).isDirectory()) {
      dst = path.resolve(args.local, path.posix.basename(p));
    } else {
      if (args.recursive) {
        throw Error(chalk`Recursive target need to be a directory.`);
      }
      dst = path.resolve('.', args.local);
    }
  }

  if (await fs.pathExists(dst)) {
    throw Error(chalk`Refusing to overwrite {yellow ${dst}}`);
  }
  const driveItem = await getDriveItem(state.root);
  const od = getOneDriveClient();
  if (args.recursive) {
    // get 'complete' drive item
    const result = await od.getDriveItem(driveItem, p, false);
    await downloadRecursively(od, path.dirname(dst), args.path, result);
  } else {
    info(chalk`saving to {yellow ${path.relative('.', dst)}}`);
    const result = await od.getDriveItem(driveItem, p, true);
    await fs.writeFile(dst, result);
  }
}

async function upload(args) {
  await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  const src = path.resolve('.', args.local);
  if (fs.lstatSync(src).isDirectory()) {
    throw Error(chalk`Uploading a directory not supported yet.`);
  }

  const dst = path.posix.join(state.cwd, args.path || path.basename(src));
  const driveItem = await getDriveItem(state.root);
  const od = getOneDriveClient();
  info(chalk`uploading {yellow ${path.relative('.', src)}} to {yellow ${dst}}`);
  const buf = await fs.readFile(src);
  await od.uploadDriveItem(buf, driveItem, dst);
}

async function listSubscriptions() {
  const od = getOneDriveClient();
  const result = await od.listSubscriptions();
  result.value.forEach((item) => {
    const {
      id, resource, expirationDateTime, notificationUrl,
    } = item;
    info(chalk`       Id: {yellow ${id}}`);
    info(chalk` Resource: {yellow ${resource}}`);
    info(chalk`      URL: {yellow ${notificationUrl}}`);
    info(chalk`  Expires: {yellow ${expirationDateTime}}\n`);
  });
}

async function poll(args) {
  await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }

  const od = getOneDriveClient();
  const resource = `/drives/${state.root.split('/')[2]}/root`;

  info('Fetching initial drive contents, this might take a while...');
  const initial = await od.fetchChanges(resource);
  const pathCache = initial.changes.filter(
    (item) => item.id && item.file && item.name && item.parentReference,
  ).reduce((map, item) => {
    const [, parent] = item.parentReference.path.split(':');
    map.set(item.id, `${parent}/${item.name}`);
    return map;
  }, new Map());
  let nextToken = initial.token;

  info('Polling for changes, enter Ctrl-c to exit.');
  process.on('SIGINT', () => {
    info('Poll terminated');
    process.exit();
  });

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => {
      setTimeout(r, 2000);
    });
    // eslint-disable-next-line no-await-in-loop
    const result = await od.fetchChanges(resource, nextToken);
    result.changes.filter(
      (change) => change.id && change.file && change.parentReference,
    ).forEach((change) => {
      const cachedPath = pathCache.get(change.id);
      const changePath = change.name && change.parentReference.path
        ? `${change.parentReference.path.split(':')[1]}/${change.name}` : null;

      if (change.deleted) {
        info(chalk`{red - ${cachedPath}}`);
        pathCache.delete(change.id);
      } else if (!cachedPath) {
        info(chalk`{green + ${changePath}}`);
        pathCache.set(change.id, changePath);
      } else if (cachedPath !== changePath) {
        info(chalk`{red - ${cachedPath}}`);
        info(chalk`{green + ${changePath}}`);
        pathCache.set(change.id, changePath);
      } else {
        info(chalk`{blue * ${changePath}}`);
      }
    });
    nextToken = result.token;
  }
}

module.exports = {
  me,
  resolve,
  ls,
  download,
  upload,
  login,
  logout,
  listSubscriptions,
  poll,
};
