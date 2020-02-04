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

/* eslint-disable global-require, no-console */

'use strict';

const yargs = require('yargs');
const { rootLogger } = require('@adobe/helix-log');
const cmdsOneDrive = require('./cmds_onedrive.js');

const MIN_MSG = 'You need at least one command.';

class CLI {
  constructor() {
    this._failFn = (message, err, argv) => {
      const msg = err ? err.message : message;
      console.error(msg);
      if (msg === MIN_MSG || /.*Unknown argument.*/.test(msg) || /.*Not enough non-option arguments:.*/.test(msg)) {
        console.error('\nUsage: %s', argv.help());
      }
      process.exit(1);
    };
  }

  run(argv) {
    return yargs()
      .command({
        command: 'me',
        desc: 'Show information about the logged in user.',
        handler: cmdsOneDrive.me,
      })
      .command({
        command: 'resolve <link>',
        desc: 'Resolves a share link to the respective drive item.',
        handler: cmdsOneDrive.resolve,
      })
      .command({
        command: 'ls [path]',
        desc: 'Lists the contents of the [path]',
        handler: cmdsOneDrive.ls,
      })
      .command({
        command: 'get <path> [local]',
        desc: 'downloads the file at path',
        handler: cmdsOneDrive.download,
        builder: (y) => y.option('recursive', {
          alias: 'r',
          type: 'boolean',
          description: 'Download recursively',
        }),
      })
      .command({
        command: 'put <local> [path]]',
        desc: 'upload the local file.',
        handler: cmdsOneDrive.upload,
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
      })
      .middleware((args) => {
        if (args.verbose) {
          rootLogger.loggers.get('default').level = 'debug';
        }
        return args;
      })
      .wrap(yargs.terminalWidth())
      .fail(this._failFn)
      .exitProcess(false)
      .strict()
      .demandCommand(1, MIN_MSG)
      .epilogue('for more information, find our manual at https://github.com/adobe/helix-onedrive-cli')
      .help()
      .parse(argv);
  }
}

module.exports = CLI;
