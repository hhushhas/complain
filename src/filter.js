export function sinceCutoff(spec, now = new Date()) {
  if (spec === undefined) return null;

  const duration = spec.match(/^(\d+)([dhm])$/);
  if (duration) {
    const unitMilliseconds = { d: 86_400_000, h: 3_600_000, m: 60_000 };
    return new Date(now.getTime() - Number(duration[1]) * unitMilliseconds[duration[2]]);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(spec)) {
    const cutoff = new Date(`${spec}T00:00:00Z`);
    if (!Number.isNaN(cutoff.getTime()) && cutoff.toISOString().startsWith(spec)) return cutoff;
  }

  throw new Error(`invalid --since value: ${spec}`);
}

export function filterSince(entries, spec) {
  const cutoff = sinceCutoff(spec);
  if (!cutoff) return entries;
  return entries.filter((entry) => Date.parse(entry.timestamp) >= cutoff.getTime());
}
