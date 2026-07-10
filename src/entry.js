export const ENTRY_START_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z — /gm;

export function timestampNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function formatEntry({ timestamp, model, harness, project, branch, review, body }) {
  const reviewTag = review ? ' (review)' : '';
  const branchTag = branch ? ` (${branch})` : '';
  const header = `${timestamp} — ${model} · ${harness}${reviewTag} — ${project}${branchTag}`;
  return `${header}\n\n${body.trim()}`;
}

function parseHeader(header) {
  const firstSeparator = header.indexOf(' — ');
  if (firstSeparator === -1) return null;
  const identityStart = firstSeparator + 3;
  const identitySeparator = header.indexOf(' · ', identityStart);
  if (identitySeparator === -1) return null;
  const secondSeparator = header.indexOf(' — ', identitySeparator + 3);
  if (secondSeparator === -1) return null;

  const timestamp = header.slice(0, firstSeparator);
  const identity = header.slice(identityStart, secondSeparator);
  const projectPart = header.slice(secondSeparator + 3);
  const separatorIndex = identity.indexOf(' · ');
  const model = identity.slice(0, separatorIndex);
  let harness = identity.slice(separatorIndex + 3);
  const review = harness.endsWith(' (review)');
  if (review) harness = harness.slice(0, -9);

  const branchMatch = projectPart.match(/^(.*) \((.*)\)$/);
  const project = branchMatch ? branchMatch[1] : projectPart;
  const branch = branchMatch?.[2];
  return { timestamp, model, harness, project, branch, review };
}

export function parseEntries(content) {
  const matches = [...content.matchAll(ENTRY_START_PATTERN)];
  return matches.flatMap((match, index) => {
    const end = matches[index + 1]?.index ?? content.length;
    const raw = content.slice(match.index, end).trimEnd();
    const lineEnd = raw.indexOf('\n');
    const header = lineEnd === -1 ? raw : raw.slice(0, lineEnd);
    const metadata = parseHeader(header);
    if (!metadata) return [];

    const bodyStart = raw.indexOf('\n\n');
    const body = bodyStart === -1 ? '' : raw.slice(bodyStart + 2).trimEnd();
    return [{ ...metadata, header, body, index }];
  });
}

export function newestFirst(entries) {
  return [...entries].sort((left, right) => {
    const timeDifference = Date.parse(right.timestamp) - Date.parse(left.timestamp);
    return timeDifference || right.index - left.index;
  });
}
