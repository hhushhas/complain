import { newestFirst } from './entry.js';
import { filterSince } from './filter.js';
import { readComplaints } from './log.js';

function countBy(entries, keyFor) {
  const counts = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function countSection(title, counts) {
  const lines = counts.length > 0 ? counts.map(([name, count]) => `  ${name}: ${count}`) : ['  (none)'];
  return `${title}\n${lines.join('\n')}`;
}

export async function runDigest({ since }) {
  const entries = newestFirst(filterSince(await readComplaints(), since));
  const window = since ? ` (since ${since})` : '';
  const projects = countBy(entries, (entry) => entry.project);
  const agents = countBy(entries, (entry) => `${entry.model} · ${entry.harness}`);
  const recent = entries.slice(0, 5).map((entry) => `${entry.header}\n\n${entry.body}`);
  const recentText = recent.length > 0 ? recent.join('\n\n') : '  (none)';

  const output = [
    `Total: ${entries.length}${window}`,
    countSection('By project:', projects),
    countSection('By model · harness:', agents),
    `Most recent:\n${recentText}`,
  ].join('\n\n');
  process.stdout.write(`${output}\n`);
}
