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
/* eslint-disable no-console */
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { getOneDriveClient } = require('./client.js');
require('dotenv').config();

const redirectUri = 'http://localhost:4502/token';

async function auth(req, res) {
  const { drive } = req.app.locals;
  crypto.randomBytes(48, (ex, buf) => {
    const state = buf.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
    const authorizationUrl = drive.createLoginUrl(redirectUri, state);
    res.cookie('authstate', state);
    res.redirect(authorizationUrl);
  });
}

async function token(req, res) {
  const { drive } = req.app.locals;
  if (req.cookies.authstate !== req.query.state) {
    res.send('error: state does not match');
    return;
  }
  try {
    await drive.acquireToken(redirectUri, req.query.code);
    res.redirect('/');
  } catch (e) {
    console.error(e);
    res.send(`error: ${e.message}`);
  }
}

async function root(req, res) {
  const { drive } = req.app.locals;
  if (!drive.authenticated) {
    res.send('unauthorized. <a href="/auth">sign in</a>');
    return;
  }
  try {
    const result = await drive.me();
    res.setHeader('content-type', 'text/html; charset=utf-8');
    const html = [
      '<html><body>',
      `welcome <b>${result.displayName}</b><br>`,
      '<form method="get" action="/list">',
      'Share link: <input name="l" size=40 value="https://adobe-my.sharepoint.com/personal/tripod_adobe_com/Documents/helix-content?csf=1&e=Fz6r5Z"><br>',
      '<button>list</button><br>',
      '</form>',
      '<br><br><a href="/subs">subscriptions</a><br>',
      '</body></html>',
    ].join('\n');
    res.end(html);
  } catch (e) {
    console.error(e);
    res.status(500).send('Something broke!');
  }
}

async function listDocuments(req, res) {
  const { drive } = req.app.locals;
  const { l } = req.query;
  if (!l) {
    res.end('no share link provided.');
    return;
  }
  try {
    const pa = req.path.replace(/\/+$/, '');
    const rootItem = await drive.getDriveItemFromShareLink(l);
    const result = await drive.listChildren(rootItem, req.path);
    const list = result.value.map((entry) => {
      const e = {
        name: entry.name,
        id: entry.id,
        link: `/${entry.folder ? 'list' : 'md'}${pa}/${entry.name}`,
      };
      return e;
    });

    const html = list.map((e) => `<a href="${e.link}?l=${encodeURIComponent(l)})">${e.name}</a><br>`);
    html.splice(0, 0, ...[
      '<html><body>',
      '<h1>drive items</h1>',
      `root: <code>${`/drives/${rootItem.parentReference.driveId}/items/${rootItem.id}`}</code><br>`,
    ]);
    html.push('</body></html>');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html.join('\n'));
  } catch (e) {
    console.error(e);
    res.status(500)
      .send('Something broke!');
  }
}

async function listSubscriptions(req, res) {
  const { drive } = req.app.locals;
  try {
    const result = await drive.listSubscriptions();
    const list = result.value.map((entry) => entry);
    console.log(result);
    const html = list.map((e) => `<a href="/subs/${e.id}">${e.resource}</a><br>`);
    if (!html.length) {
      html.push('no subscriptions.<br>');
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    html.splice(0, 0, ...[
      '<html><body>',
      '<h1>subscriptions</h1>',
    ]);
    html.push(...[
      '<br>',
      '<hr>Create new:',
      '<form method="post" action="/subs">',
      'resource: <input name="r" size=40 value="/drives/b!O3W0KoHNgkGJDqK0Mx3HRg0KyUx90AtIiO0o6b7VpaHBBzev_e85S41-2BAnw1ma/root"><br>',
      'state: <input name="s" size=40 value="foo-bar"><br>',
      'exp: <input name="e" size=40 value="10">minutes<br>',
      'hook: <input name="h" size=40 value="https://01fe5492.ngrok.io/hook"><br>',
      '<button>create</button><br>',
      '</form>',
      '</body></htm>',
    ]);
    res.end(html.join('\n'));
  } catch (e) {
    console.error(e);
    res.status(500)
      .send('Something broke!');
  }
}

async function createSubscription(req, res) {
  const { drive } = req.app.locals;
  try {
    const result = await drive.createSubscription({
      resource: req.body.r,
      clientState: req.body.s,
      notificationUrl: req.body.h,
      expirationDateTime: (new Date(Date.now()
        + Number.parseInt(req.body.e, 10) * 60000)).toISOString(),
      changeType: 'updated',
    });
    res
      .set('content-type', 'text/plan')
      .end(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
    res.status(500)
      .send('Something broke!');
  }
}

async function md(req, res) {
  const { drive } = req.app.locals;
  const { l } = req.query;
  if (!l) {
    res.end('no share link provided.');
    return;
  }
  try {
    const rootItem = await drive.getDriveItemFromShareLink(l);
    const result = await drive.getDriveItem(rootItem, req.path, true);
    res.setHeader('content-type', 'application/octet-stream');
    res.send(result);
  } catch (e) {
    console.error(e);
    res.status(500)
      .send('Something broke!');
  }
}

function asyncHandler(fn) {
  return (req, res, next) => (Promise.resolve(fn(req, res, next)).catch(next));
}

async function run() {
  const app = express();
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false }));

  // generate login redirect
  app.get('/auth', asyncHandler(auth));

  // After consent is granted AAD redirects here.
  app.get('/token', asyncHandler(token));

  app.use('/list', express.Router().get('*', asyncHandler(listDocuments)));
  app.use('/subs', express.Router().get('*', asyncHandler(listSubscriptions)));
  app.use('/subs', express.Router().post('*', asyncHandler(createSubscription)));
  app.use('/md', express.Router().get('*', asyncHandler(md)));
  app.get('/', asyncHandler(root));

  app.locals.drive = await getOneDriveClient();

  const srv = app.listen(4502, () => console.log(`Started development server on http://localhost:${srv.address().port}/`));
}

run().catch(console.error);
