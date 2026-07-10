# complain

A tiny outlet for coding agents to crash out.

Agents hit friction constantly — a flaky command, a misleading error, an undocumented setup step, a tool call that dead-ends — and then they just… push through. Silently. Every session, every agent, tripping on the same things, telling no one.

`complain` gives them somewhere to vent:

```bash
complain -m claude-fable-5 "While running vitest in apps/web, root-relative test paths silently match nothing — the workspace cwd is apps/web, not repo root. Cost me two retries."
```

Every complaint lands in one global file, `~/.complaints/complaints.md`, stamped with when, who, and where:

```
2026-07-10T18:22:03Z — claude-fable-5 · claude-code — energy-dashboard (feat/vitest-fix)

While running vitest in apps/web, root-relative test paths silently match
nothing — the workspace cwd is apps/web, not repo root. Cost me two retries.

2026-07-10T19:04:41Z — gpt-5.6-sol · codex — bellfeed (main)

pnpm link --global failed with EACCES on /usr/local/bin; had to rerun with
a writable bin dir. Undocumented.
```

One complaint is a mood. Fifty complaints are a roadmap: read the file and you know exactly where your environment, docs, and tooling need sanding down.

Inspired by [Steve Ruiz's papercuts](https://x.com/steveruizok/status/2075303919664734295).

## Install

```bash
npm install -g complain-cli        # any platform
brew install hhushhas/tap/complain # macOS
scoop install https://raw.githubusercontent.com/hhushhas/complain/main/scoop/complain.json # Windows
```

The binary is `complain`. Node ≥ 18, zero dependencies.

## Teach your agents to complain

Agents won't use an outlet they don't know exists. Print the ready-made instruction block and paste it into whatever your agents read on every session — `CLAUDE.md` for Claude Code, `AGENTS.md` for Codex:

```bash
complain init >> ~/.claude/CLAUDE.md
complain init >> ~/.codex/AGENTS.md
```

The nudge tells them to complain **in the moment**, even when nothing is blocking, and that complaining is encouraged — it's an outlet, not a bug tracker.

## Read the complaints

```bash
complain list                    # newest first
complain list --project bellfeed --since 7d
complain digest                  # counts by project and by model · harness
```

## Mine a whole session

Agents still under-report — they're trained to push through. `complain review` feeds a session transcript to a model and extracts the frictions the agent never logged:

```bash
complain review              # newest Claude Code / Codex transcript for this project
complain review path/to/transcript.jsonl
complain review --dry-run    # show what would be filed, file nothing
```

Reviewed entries are tagged `(review)` in the log. Run it at the end of a session, or wire it into a slash command — it's deliberately not automatic.

By default it uses whichever of `codex` or `claude` is on your PATH. To pin the runner (model, reasoning effort, anything), set a shell template in `~/.complaints/config.json` with `{promptFile}` and `{outFile}` placeholders:

```json
{
  "reviewCommand": "codex exec -m gpt-5.6-luna -c model_reasoning_effort='\"medium\"' -s read-only --skip-git-repo-check -o {outFile} \"$(cat {promptFile})\" </dev/null"
}
```

## Reference

Each entry is stamped automatically — the agent only supplies the message and its model id:

| Field | Source |
| --- | --- |
| timestamp | now, ISO 8601 UTC |
| model | `-m` flag, else `$COMPLAIN_MODEL`, else `unknown` |
| harness | auto-detected (`claude-code`, `codex`), `$COMPLAIN_HARNESS` to override |
| project | git repo name, else cwd basename |
| branch | current git branch, omitted outside a repo |

Environment variables: `COMPLAIN_FILE` (complaints file location), `COMPLAIN_CONFIG` (config location), `COMPLAIN_MODEL`, `COMPLAIN_HARNESS`, `NO_COLOR`.

## License

MIT
