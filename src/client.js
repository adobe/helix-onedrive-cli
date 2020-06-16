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
const chalk = require('chalk');
const { OneDrive } = require('@adobe/helix-onedrive-support');
const { info, SimpleInterface } = require('@adobe/helix-log');

const STATE_FILE = '.hlx-1d.json';
const AUTH_FILE = '.auth.json';
const DEFAULT_CLIENT_ID = 'f4c79ff7-bbd2-4b36-822e-a89eb6de4578';

let state = {};

function getState() {
  return state;
}

async function loadState() {
  try {
    state = await fs.readJson(STATE_FILE);
  } catch (e) {
    // ignore
  }
  return state;
}
async function saveState() {
  await fs.writeJson(STATE_FILE, state);
}

let client = null;

/**
 * Return the OneDrive client.
 *
 * @returns {OneDrive} OneDrive client
 */
function getOneDriveClient() {
  if (client) {
    return client;
  }
  const {
    AZURE_APP_CLIENT_ID: clientId = DEFAULT_CLIENT_ID,
    AZURE_APP_CLIENT_SECRET: clientSecret = '',
    AZURE_APP_REFRESH_TOKEN: refreshToken = '',
    AZURE_APP_TENANT: tenant = '',
    AZURE_APP_USER: username = '',
    AZURE_APP_PASS: password = '',
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
    username,
    password,
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

module.exports = {
  getState,
  loadState,
  saveState,
  getOneDriveClient,
};
