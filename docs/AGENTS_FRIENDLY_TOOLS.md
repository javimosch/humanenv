# Agent-Friendly CLI Design

> Build CLIs that AI agents consume without guessing. Structured output, semantic errors, zero interactivity.

## Core Contract

| Rule | Why |
|------|-----|
| Every command supports `--json` | Agents parse JSON, not prose |
| `stdout` = data, `stderr` = logs | Never mix parseable output with noise |
| Exit codes are semantic | Agents decide retry strategy from the code |
| No interactive prompts | Agents cannot respond to stdin prompts |
| Errors include `recoverable` field | Agents know whether to retry or abort |

## Output Separation

```bash
# stdout: parseable data only
{"trace_file": "/tmp/trace.json", "size_mb": 45.2}

# stderr: progress, warnings, logs (agents ignore this)
[stderr] Capturing... 15s elapsed
[stderr] Capturing... 30s complete
```

## Flags Every Command Needs

| Flag | Purpose |
|------|--------|
| `--json` | Machine-readable JSON on stdout |
| `--no-interactive` | Fail instead of prompting |
| `--no-color` | Strip ANSI codes |
| `--plain` | Tab-separated for pipelines |

## Semantic Exit Codes

| Range | Category | Agent Action |
|-------|----------|-------------|
| `0` | Success | Proceed |
| `80-89` | Input/validation error | Fix input, don't retry |
| `90-99` | Resource/state error | Clarify or try alternate |
| `100-109` | External/integration error | Retry with backoff |
| `110-119` | Internal bug | Report, don't retry |

## Error Format

```json
{
  "error": {
    "code": 92,
    "type": "resource_not_found",
    "message": "Request req_123 not found",
    "recoverable": false,
    "suggestions": ["List recent: tool list --recent"]
  }
}
```

The tool reports errors clearly. The tool does NOT retry — the agent decides.

## TTY Detection

```javascript
if (process.stdout.isTTY) {
  // Human: colors, tables, interactive prompts
} else {
  // Agent: structured JSON, no colors, fail on prompts
}
```

Override with `--json`, `--no-color`, `--no-interactive`.

## Self-Describing Commands

```bash
$ tool --help-json
{
  "version": "1.2.0",
  "commands": {
    "get": {"args": ["key"], "flags": {"--json": "JSON output"}}
  },
  "exit_codes": {"0": "success", "92": "not_found"}
}
```

Agents query capabilities at runtime — they don't read docs.

## Checklist

| Requirement | Status |
|------------|--------|
| `--json` and `--no-interactive` on every command | ☐ |
| Data → stdout, logs → stderr | ☐ |
| Semantic exit codes (0, 80-119) | ☐ |
| Typed errors with `recoverable` field | ☐ |
| `--help-json` for machine-readable schema | ☐ |
| Pipeable: accepts stdin, single responsibility | ☐ |
| Output schema versioned (additive changes only) | ☐ |
