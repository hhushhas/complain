import { newestFirst } from './entry.js';
import { filterSince } from './filter.js';
import { readComplaints } from './log.js';

function parseCount(value) {
  if (value === undefined) return 20;
  if (!/^\d+$/.test(value) || Number(value) < 1) throw new Error('-n must be a positive integer');
  return Number(value);
}

function printEntry(entry) {
  const color = process.stdout.isTTY && process.env.NO_COLOR === undefined;
  const header = color ? `\u001b[2m${entry.header}\u001b[22m` : entry.header;
  return `${header}\n\n${entry.body}`;
}

export async function runList({ project, since, count }) {
  let entries = await readComplaints();
  if (project) entries = entries.filter((entry) => entry.project === project);
  entries = newestFirst(filterSince(entries, since)).slice(0, parseCount(count));

  if (entries.length === 0) {
    process.stdout.write('No complaints found.\n');
    return;
  }
  process.stdout.write(`${entries.map(printEntry).join('\n\n')}\n`);
}
