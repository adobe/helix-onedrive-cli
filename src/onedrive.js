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
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk-template';
import { URLSearchParams } from 'url';
import { MountConfig } from '@adobe/helix-shared-config';
import { debug, error, info } from './logging.js';
import {
  getOneDriveClient, getState, loadState, saveState,
} from './client.js';

const AUTH_FILE = '.auth.json';

async function login() {
  const od = await getOneDriveClient();
  const result = await od.me();
  info(chalk`Logged in as: {yellow ${result.displayName}} {grey (${result.mail})}`);
}

async function logout() {
  // for now, we just delete the .auth.json
  await fs.remove(AUTH_FILE);
}

async function me() {
  const od = await getOneDriveClient();
  await od.me();
  const result = await od.me();
  info(chalk`Logged in as: {yellow ${result.displayName}} {grey (${result.mail})}`);
}

async function resolve(args) {
  const od = await getOneDriveClient();
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
  const state = await getState();
  state.link = link;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateFormat(s) {
  const d = new Date(s);
  const date = `${MONTHS[d.getMonth()]} ${d.getDate().toString().padStart(2, ' ')}`;
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  return `${date} ${time}`;
}

function graphApiFormatter(item) {
  const user = item.lastModifiedBy.user.email;
  const date = item.lastModifiedDateTime;
  const size = item.folder?.childCount ?? item.size;
  let { name } = item;
  if (item.folder) {
    name = chalk`{blue ${name}}`;
  }
  return `${user.padEnd(18, ' ')}${size.toString().padStart(10, ' ')} ${dateFormat(date)} ${name}\n`;
}

function sharePointApiFormatter(item) {
  const user = item.ModifiedBy?.UserPrincipalName ?? '';
  const date = item.TimeLastModified;
  const size = item.ItemCount ?? item.Length;
  let { Name: name } = item;

  if (item.ItemCount) {
    name = chalk`{blue ${name}}`;
  }
  return `${user.padEnd(18, ' ')}${size.toString().padStart(10, ' ')} ${dateFormat(date)} ${name}\n`;
}

async function ls(args) {
  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  if (args.path && args.path.startsWith('https://')) {
    throw Error(chalk`${args._[0]} does not work on share links directly. use '{grey ${args.$0} resolve}' to set root.`);
  }

  const children = [];
  let formatter;

  if (args.sharepoint) {
    const od = await getOneDriveClient();
    const site = await od.getSite(state.link);

    let folder;
    try {
      folder = await site.getFolder(args.path);
    } catch (e) {
      if (e.statusCode !== 404) {
        throw e;
      }
    }
    if (folder) {
      const result = await site.getFilesAndFolders(args.path);
      children.push(...result.d.Folders.results);
      children.push(...result.d.Files.results);
      children.sort(({ Name: name1 }, { Name: name2 }) => name1.localeCompare(name2));
    } else {
      const result = await site.getFile(args.path);
      children.push(result.d);
    }
    formatter = sharePointApiFormatter;
  } else {
    const p = path.posix.join(state.cwd, args.path || '');
    const driveItem = await getDriveItem(state.root);
    const od = await getOneDriveClient();
    const item = await od.getDriveItem(driveItem, p);
    if (item.folder) {
      const result = await od.listChildren(driveItem, p);
      children.push(...result.value);
      children.sort(({ name: name1 }, { name: name2 }) => name1.localeCompare(name2));
    } else {
      children.push(item);
    }
    formatter = graphApiFormatter;
  }

  children.forEach((child) => {
    process.stdout.write(formatter(child));
  });
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
  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  if (args.recursive && args.sharepoint) {
    throw Error(chalk`Recursive download via Sharepoint API not supported yet.`);
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
  const od = await getOneDriveClient();
  if (args.recursive) {
    // get 'complete' drive item
    const result = await od.getDriveItem(driveItem, p, false);
    await downloadRecursively(od, path.dirname(dst), args.path, result);
  } else {
    info(chalk`saving to {yellow ${path.relative('.', dst)}}`);
    let result;
    if (args.sharepoint) {
      const site = await od.getSite(state.link);
      result = await site.getFileContents(args.path);
    } else {
      result = await od.getDriveItem(driveItem, p, true);
    }
    await fs.writeFile(dst, result);
  }
}

async function upload(args) {
  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }
  const src = path.resolve('.', args.local);
  if (fs.lstatSync(src).isDirectory()) {
    throw Error(chalk`Uploading a directory not supported yet.`);
  }

  const dst = path.posix.join(state.cwd, args.path || path.basename(src));
  const driveItem = await getDriveItem(state.root);
  const od = await getOneDriveClient();
  info(chalk`uploading {yellow ${path.relative('.', src)}} to {yellow ${dst}}`);
  const buf = await fs.readFile(src);
  const item = await od.uploadDriveItem(buf, driveItem, dst);

  process.stdout.write(chalk` {yellow ${item.id}} /${item.name}\n`);
}

async function createSubscription(args) {
  const {
    owner, repo, ref, target,
  } = args;
  const od = await getOneDriveClient();

  const config = (await new MountConfig()
    .withRepo(owner, repo, ref)
    .init()).toJSON();

  const mountpoints = Object.values(config.mountpoints)
    .filter((v) => v.match(/https:\/\/[^.]+\.sharepoint.com/));
  if (mountpoints.length === 0) {
    error('No OneDrive mountpoints found.');
    return;
  }
  const [mountpoint] = mountpoints;
  info(chalk`Resolving shared link for {yellow ${mountpoint}}`);
  const { parentReference: { path: parentPath } } = await od.resolveShareLink(mountpoint);
  const [resource] = parentPath.split(':');
  info(chalk`Resolved resource: {yellow ${resource}}`);

  let prefix;
  const version = args['action-version'];
  if (target === 'aws') {
    const region = args['aws-region'];
    const api = args['aws-api'];
    if (!api) {
      error('No AWS API Gateway endpoint specified.');
      return;
    }
    prefix = `https://${api}.execute-api.${region}.amazonaws.com/helix-observation/onedrive-listener/${version}/hook`;
  } else {
    prefix = `https://adobeioruntime.net/api/v1/web/helix-index/helix-observation/onedrive-listener@${version}/hook`;
  }
  const params = new URLSearchParams();
  params.append('owner', owner);
  params.append('repo', repo);
  params.append('ref', ref);
  const url = `${prefix}?${params.toString()}`;

  const result = await od.createSubscription({
    resource,
    notificationUrl: url,
    clientState: args['client-state'],
  });

  const {
    id, expirationDateTime,
  } = result;
  info(chalk`       Id: {yellow ${id}}`);
  info(chalk` Resource: {yellow ${resource}}`);
  info(chalk`      URL: {yellow ${url}}`);
  info(chalk`  Expires: {yellow ${expirationDateTime}}\n`);
}

async function listSubscriptions() {
  const od = await getOneDriveClient();
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

async function refreshSubscription(args) {
  const { id } = args;

  const od = await getOneDriveClient();
  const result = await od.refreshSubscription(id);

  const {
    resource, expirationDateTime, notificationUrl,
  } = result;
  info(chalk`       Id: {yellow ${id}}`);
  info(chalk` Resource: {yellow ${resource}}`);
  info(chalk`      URL: {yellow ${notificationUrl}}`);
  info(chalk`  Expires: {yellow ${expirationDateTime}}\n`);
}

async function deleteSubscription(args) {
  const { id } = args;

  const od = await getOneDriveClient();
  await od.deleteSubscription(id);
}

async function poll(args) {
  const { skip } = args;

  const state = await loadState();
  if (!state.root) {
    throw Error(chalk`${args._[0]} needs path. use '{grey ${args.$0} resolve}' to set root.`);
  }

  const od = await getOneDriveClient();
  const resource = `/drives/${state.root.split('/')[2]}/root`;

  const pathCache = new Map();
  let nextToken;

  if (!skip) {
    info('Fetching initial drive contents, this might take a while...');
    const initial = await od.fetchChanges(resource);
    initial.changes.filter(
      (item) => item.id && item.file && item.name && item.parentReference,
    ).reduce((map, item) => {
      const [, parent] = item.parentReference.path.split(':');
      map.set(item.id, `${parent}/${item.name}`);
      return map;
    }, pathCache);
    nextToken = initial.token;
  } else {
    const initial = await od.fetchChanges(resource, 'latest');
    nextToken = initial.token;
  }

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
        info(chalk`{red - ${cachedPath || 'unknown'}}`);
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

export default {
  me,
  resolve,
  ls,
  download,
  upload,
  login,
  logout,
  listSubscriptions,
  createSubscription,
  refreshSubscription,
  deleteSubscription,
  poll,
};
