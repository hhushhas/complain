#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { runDigest } from '../src/digest.js';
import { runInit } from '../src/init.js';
import { runList } from '../src/list.js';
import { runLog } from '../src/log.js';
import { runReview } from '../src/review.js';

const usage = `Usage:
  complain [-m <model>] "<message>"
  complain list [--project <p>] [--since <spec>] [-n <count>]
  complain digest [--since <spec>]
  complain review [<transcript-path>] [--dry-run]
  complain init
  complain --help | --version

Since specs: 7d, 24h, 30m, or YYYY-MM-DD.
An exact first argument of list, digest, review, or init selects that command;
all other arguments are treated as a complaint message.`;

function takeValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${option} requires a value`);
  return value;
}

function parseLogArgs(args) {
  let model;
  const message = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-m' || arg === '--model') {
      model = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    message.push(arg);
  }

  return { model, message: message.join(' ') };
}

function parseListArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--project' || arg === '--since' || arg === '-n') {
      const key = arg === '-n' ? 'count' : arg.slice(2);
      options[key] = takeValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`unknown list option: ${arg}`);
  }
  return options;
}

function parseDigestArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === '--since') return { since: args[1] };
  throw new Error('usage: complain digest [--since <spec>]');
}

function parseReviewArgs(args) {
  let transcriptPath;
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`unknown review option: ${arg}`);
    if (transcriptPath) throw new Error('review accepts only one transcript path');
    transcriptPath = arg;
  }

  return { transcriptPath, dryRun };
}

async function readVersion() {
  const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  return packageJson.version;
}

async function main() {
  const [first, ...rest] = process.argv.slice(2);

  if (first === '--help' || first === '-h') {
    process.stdout.write(`${usage}\n`);
    return;
  }
  if (first === '--version' || first === '-v') {
    process.stdout.write(`${await readVersion()}\n`);
    return;
  }
  if (first === 'list') return runList(parseListArgs(rest));
  if (first === 'digest') return runDigest(parseDigestArgs(rest));
  if (first === 'review') return runReview(parseReviewArgs(rest));
  if (first === 'init') {
    if (rest.length > 0) throw new Error('init accepts no arguments');
    return runInit();
  }

  const { model, message } = parseLogArgs(process.argv.slice(2));
  if (!message) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 1;
    return;
  }
  await runLog({ model, message });
}

main().catch((error) => {
  process.stderr.write(`complain: ${error.message}\n`);
  process.exitCode = 1;
});
