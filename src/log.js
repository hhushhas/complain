import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { complaintPath, detectHarness, detectModel, projectContext } from './context.js';
import { formatEntry, parseEntries, timestampNow } from './entry.js';

export async function readComplaintFile() {
  try {
    return await readFile(complaintPath(), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw new Error(`could not read complaints: ${error.message}`);
  }
}

export async function readComplaints() {
  return parseEntries(await readComplaintFile());
}

async function acquireLock(path) {
  const lockPath = `${path}.lock`;
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const handle = await open(lockPath, 'wx');
      return async () => {
        await handle.close();
        await unlink(lockPath).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    await delay(10);
  }

  throw new Error('timed out waiting for another complaint writer');
}

export async function appendEntries(entries) {
  const path = complaintPath();
  try {
    await mkdir(dirname(path), { recursive: true });
  } catch (error) {
    throw new Error(`could not file complaint: ${error.message}`);
  }

  let releaseLock;
  let temporaryPath;
  try {
    releaseLock = await acquireLock(path);
    const existing = await readComplaintFile();
    const additions = entries.map(formatEntry).join('\n\n');
    const content = existing.trimEnd()
      ? `${existing.trimEnd()}\n\n${additions}\n`
      : `${additions}\n`;
    temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, path);
    temporaryPath = undefined;
    return parseEntries(content).length;
  } catch (error) {
    throw new Error(`could not file complaint: ${error.message}`);
  } finally {
    if (temporaryPath) await unlink(temporaryPath).catch(() => {});
    if (releaseLock) await releaseLock();
  }
}

export async function runLog({ model, message }) {
  const { project, branch } = projectContext();
  const total = await appendEntries([{
    timestamp: timestampNow(),
    model: detectModel(model),
    harness: detectHarness(),
    project,
    branch,
    body: message,
  }]);
  process.stdout.write(`✓ complaint filed (#${total})\n`);
}
