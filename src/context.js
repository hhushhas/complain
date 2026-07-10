import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

export function complaintPath() {
  return process.env.COMPLAIN_FILE || join(homedir(), '.complaints', 'complaints.md');
}

export function configPath() {
  return process.env.COMPLAIN_CONFIG || join(homedir(), '.complaints', 'config.json');
}

export function detectHarness() {
  if (process.env.COMPLAIN_HARNESS) return process.env.COMPLAIN_HARNESS;
  if (process.env.CODEX_THREAD_ID !== undefined) return 'codex';
  if (process.env.CLAUDECODE !== undefined || process.env.CLAUDE_CODE_ENTRYPOINT !== undefined) {
    return 'claude-code';
  }
  return 'terminal';
}

export function detectModel(flagModel) {
  return flagModel || process.env.COMPLAIN_MODEL || 'unknown';
}

function gitOutput(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

export function projectContext(cwd = process.cwd()) {
  const root = gitOutput(['rev-parse', '--show-toplevel'], cwd);
  const project = basename(root || cwd);
  const branch = root ? gitOutput(['branch', '--show-current'], cwd) : '';
  return { project, branch };
}

export async function readConfig() {
  let content;
  try {
    content = await readFile(configPath(), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`could not read config: ${error.message}`);
  }

  let config;
  try {
    config = JSON.parse(content);
  } catch {
    throw new Error(`config is not valid JSON: ${configPath()}`);
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('config must be a JSON object');
  }
  if (config.reviewCommand !== undefined && typeof config.reviewCommand !== 'string') {
    throw new Error('config reviewCommand must be a string');
  }
  return config;
}
