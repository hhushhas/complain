import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function runInit() {
  const promptPath = fileURLToPath(new URL('../prompts/nudge.md', import.meta.url));
  process.stdout.write(await readFile(promptPath, 'utf8'));
}
