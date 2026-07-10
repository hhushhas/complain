import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, open, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { configPath, projectContext, readConfig } from './context.js';
import { formatEntry, timestampNow } from './entry.js';
import { appendEntries, readComplaints } from './log.js';

const MAX_TRANSCRIPT_BYTES = 300 * 1024;
const DEFAULT_CODEX_COMMAND = `codex exec -m gpt-5.6-luna -c model_reasoning_effort='"medium"' -c service_tier='"standard"' -s read-only --skip-git-repo-check -o {outFile} - < {promptFile}`;
const DEFAULT_CLAUDE_COMMAND = 'claude -p < {promptFile} > {outFile}';

function commandExists(command) {
  return spawnSync('sh', ['-c', `command -v ${command} >/dev/null 2>&1`], {
    stdio: 'ignore',
  }).status === 0;
}

function defaultReviewCommand() {
  if (commandExists('codex')) return DEFAULT_CODEX_COMMAND;
  if (commandExists('claude')) return DEFAULT_CLAUDE_COMMAND;
  throw new Error(`no model CLI found; set reviewCommand in ${configPath()}`);
}

async function jsonlFiles(directory, recursive) {
  let items;
  try {
    items = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const item of items) {
    const path = join(directory, item.name);
    if (item.isFile() && item.name.endsWith('.jsonl')) files.push(path);
    if (recursive && item.isDirectory()) files.push(...await jsonlFiles(path, true));
  }
  return files;
}

async function newestFile(files) {
  const dated = await Promise.all(files.map(async (path) => ({ path, mtime: (await stat(path)).mtimeMs })));
  dated.sort((left, right) => right.mtime - left.mtime);
  return dated[0]?.path;
}

function claudeProjectSlug(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

async function discoverTranscript() {
  const claudeDirectory = join(homedir(), '.claude', 'projects', claudeProjectSlug(process.cwd()));
  const claudeTranscript = await newestFile(await jsonlFiles(claudeDirectory, false));
  if (claudeTranscript) return claudeTranscript;

  const codexDirectory = join(homedir(), '.codex', 'sessions');
  const codexTranscript = await newestFile(await jsonlFiles(codexDirectory, true));
  if (codexTranscript) return codexTranscript;

  throw new Error(`no transcript found in ${claudeDirectory} or ${codexDirectory}`);
}

async function resolveTranscript(givenPath) {
  const path = givenPath || await discoverTranscript();
  try {
    const details = await stat(path);
    if (!details.isFile()) throw new Error('path is not a file');
  } catch (error) {
    throw new Error(`could not read transcript ${path}: ${error.message}`);
  }
  process.stdout.write(`Transcript: ${path}\n`);
  return path;
}

async function readTranscriptTail(path) {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const length = Math.min(size, MAX_TRANSCRIPT_BYTES);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, size - length);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return size > MAX_TRANSCRIPT_BYTES ? `[transcript truncated]\n${text}` : text;
  } finally {
    await handle.close();
  }
}

async function buildPrompt(transcriptPath, project) {
  const templatePath = fileURLToPath(new URL('../prompts/review.md', import.meta.url));
  const [template, transcript, complaints] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readTranscriptTail(transcriptPath),
    readComplaints(),
  ]);
  const logged = complaints.filter((entry) => entry.project === project).slice(-50);
  const alreadyLogged = logged.length > 0 ? logged.map((entry) => entry.body).join('\n\n') : '(none)';
  return template
    .replace('{{ALREADY_LOGGED}}', alreadyLogged)
    .replace('{{TRANSCRIPT}}', transcript);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function execute(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', (error) => reject(new Error(`could not start review command: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`review command failed with exit code ${code}`));
      else resolve(stdout);
    });
  });
}

function jsonArrayAt(output, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < output.length; index += 1) {
    const character = output[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    if (character === '[') depth += 1;
    if (character === ']') depth -= 1;
    if (depth === 0) return output.slice(start, index + 1);
  }
  return null;
}

function parseReviewOutput(output) {
  for (let start = output.indexOf('['); start !== -1; start = output.indexOf('[', start + 1)) {
    const json = jsonArrayAt(output, start);
    if (!json) continue;

    try {
      const items = JSON.parse(json);
      if (!Array.isArray(items)) continue;
      const valid = items.every((item) => item && typeof item.model === 'string'
        && typeof item.harness === 'string' && typeof item.message === 'string');
      if (valid) return items;
    } catch {
      continue;
    }
  }
  return null;
}

async function readRunnerOutput(commandTemplate, outFile, stdout) {
  if (!commandTemplate.includes('{outFile}')) return stdout;
  try {
    return await readFile(outFile, 'utf8');
  } catch (error) {
    throw new Error(`review command did not write ${outFile}: ${error.message}`);
  }
}

export async function runReview({ transcriptPath, dryRun }) {
  const path = await resolveTranscript(transcriptPath);
  const { project } = projectContext();
  const prompt = await buildPrompt(path, project);
  const directory = await mkdtemp(join(tmpdir(), 'complain-review-'));
  const promptFile = join(directory, 'prompt.md');
  const outFile = join(directory, 'output.txt');
  let keepRawOutput = false;

  try {
    await writeFile(promptFile, prompt, 'utf8');
    const config = await readConfig();
    const template = config.reviewCommand || defaultReviewCommand();
    const command = template
      .replaceAll('{promptFile}', shellQuote(promptFile))
      .replaceAll('{outFile}', shellQuote(outFile));
    const stdout = await execute(command);
    const output = await readRunnerOutput(template, outFile, stdout);
    const items = parseReviewOutput(output);

    if (!items) {
      const rawOutput = join(directory, 'raw-output.txt');
      await writeFile(rawOutput, output, 'utf8');
      keepRawOutput = true;
      process.stderr.write(`Review output: ${rawOutput}\n`);
      throw new Error('review command returned malformed output');
    }
    if (items.length === 0) {
      process.stdout.write('No unlogged complaints found.\n');
      return;
    }

    const timestamp = timestampNow();
    const entries = items.map((item) => ({
      timestamp,
      model: item.model,
      harness: item.harness,
      review: true,
      project,
      body: item.message,
    }));
    if (!dryRun) await appendEntries(entries);

    process.stdout.write(`\n${entries.map(formatEntry).join('\n\n')}\n`);
    process.stdout.write(`✓ ${entries.length} complaints filed from review\n`);
  } finally {
    if (keepRawOutput) {
      await Promise.all([rm(promptFile, { force: true }), rm(outFile, { force: true })]);
    } else {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
