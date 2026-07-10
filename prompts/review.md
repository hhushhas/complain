# Session complaint review

You are reviewing a coding-agent session transcript. Your job is to extract **complaints**: small environment and tooling frictions the agent hit while working but never logged. Agents tend to push through problems silently; you are the second pass that catches what they didn't say.

## What counts as a complaint

Friction in the *working environment*, not in the work itself:

- A command that failed for an environmental reason — missing tool, wrong working directory, bad PATH, stale cache, permissions, wrong package manager.
- A misleading error message or a silent failure that cost the agent retries.
- A confusing, undocumented, or surprising setup step.
- A flaky command or tool call that needed retrying.
- A dead-end: broken link, missing file that docs said would exist, script that no longer works.
- A convention mismatch the agent tripped on (test paths relative to the wrong root, globbing quirks, tab-indented YAML, etc.).

## What does NOT count

- The bug or task the agent was asked to work on — that is the work, not friction around it.
- Mistakes caused purely by the agent's own reasoning, unless the environment made the mistake easy to make.
- User decisions, requirement changes, or feedback.
- Anything in the "already logged" list below — do not repeat existing complaints, even reworded.

## Output

Respond with **only** a JSON array, no prose before or after. Each element:

```json
{
  "model": "<model id the agent ran on, from the transcript; \"unknown\" if absent>",
  "harness": "<claude-code | codex | unknown>",
  "message": "<1–2 sentences: what the agent was doing → what got in the way. A guess at the cause or fix is a bonus.>"
}
```

Write each message in first person past tense, as the agent would ("While running X, Y happened..."). Be specific: name the command, the error, the path. One complaint per distinct friction; merge repeats of the same friction into one entry. If the session had no unlogged frictions, respond with `[]`.

## Already logged this project (do not repeat)

{{ALREADY_LOGGED}}

## Transcript

{{TRANSCRIPT}}
