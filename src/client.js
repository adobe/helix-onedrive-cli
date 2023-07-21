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
import openBrowser from 'open';
import chalk from 'chalk-template';
import { OneDrive, OneDriveAuth, AcquireMethod } from '@adobe/helix-onedrive-support';
import { FSCachePlugin } from '@adobe/helix-shared-tokencache';
import { logger, info } from './logging.js';

const STATE_FILE = '.hlx-1d.json';
const AUTH_FILE = '.auth.json';
// default client id is from microsoft's adal client
const DEFAULT_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';

let state = {};

export function getState() {
  return state;
}

export async function loadState() {
  try {
    state = await fs.readJson(STATE_FILE);
  } catch (e) {
    // ignore
  }
  return state;
}
export async function saveState() {
  await fs.writeJson(STATE_FILE, state);
}

let client = null;

/**
 * Return the OneDrive client.
 *
 * @returns {OneDrive} OneDrive client
 */
export async function getOneDriveClient(shareUrl) {
  if (client) {
    return client;
  }
  const {
    AZURE_APP_CLIENT_ID: clientId = DEFAULT_CLIENT_ID,
    AZURE_APP_CLIENT_SECRET: clientSecret = '',
    AZURE_APP_TENANT: tenant = state.tenant || '',
  } = process.env;

  if (!clientId) {
    info(chalk`{red error:} Missing clientId and/or client secret environment.`);
    info(chalk`Suggest to create a {yellow .env} file with:\n`);
    info(chalk`AZURE_APP_CLIENT_ID={gray <client-id of the app>}`);
    info(chalk`AZURE_APP_CLIENT_SECRET={gray <client-secret of the app>}`);
    process.exit(-1);
  }

  if (!tenant && !shareUrl) {
    info(chalk`{red error:} Missing tenant environment. run 1d resolve to set one.`);
    info(chalk`Suggest to create a {yellow .env} file with:\n`);
    info(chalk`AZURE_APP_TENANT={gray <sharepoint tenant>}`);
    process.exit(-1);
  }

  const auth = new OneDriveAuth({
    clientId,
    clientSecret,
    tenant,
    localAuthCache: true,
    cachePlugin: new FSCachePlugin({ log: logger, filePath: AUTH_FILE }),
    onCode: async (code) => {
      info(code.message);
      await openBrowser(code.verificationUri);
    },
    acquireMethod: state.delegated
      ? AcquireMethod.BY_DEVICE_CODE
      : AcquireMethod.BY_CLIENT_CREDENTIAL,
    log: logger,
  });

  if (!tenant) {
    await auth.initTenantFromUrl(shareUrl);
  }

  await auth.authenticate();

  state.tenant = auth.tenant;
  await saveState();

  client = new OneDrive({ auth });
  return client;
}
