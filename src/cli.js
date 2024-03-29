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
import yargs from 'yargs';
import { logger } from './logging.js';

const MIN_MSG = 'You need at least one command.';

export default class CLI {
  constructor(plugins = []) {
    this._failFn = (message, err, argv) => {
      const msg = err ? err.message : message;
      console.error(msg);
      if (msg === MIN_MSG || /.*Unknown argument.*/.test(msg) || /.*Not enough non-option arguments:.*/.test(msg)) {
        console.error('\nUsage: %s', argv.help());
      }
      process.exit(1);
    };
    this._plugins = plugins;
  }

  async run(argv) {
    const y = yargs();
    await Promise.all(this._plugins.map(async (p) => p(y)));
    return y
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
      })
      .middleware((args) => {
        if (args.verbose) {
          logger.level = 'debug';
        }
        return args;
      })
      .wrap(y.terminalWidth())
      .fail(this._failFn)
      .exitProcess(false)
      .strict()
      .demandCommand(1, MIN_MSG)
      .epilogue('for more information, find our manual at https://github.com/adobe/helix-onedrive-cli')
      .help()
      .parse(argv);
  }
}
