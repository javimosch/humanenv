# Agent-Friendly CLI Design

> Build CLIs that AI agents consume efficiently. Maximum signal, minimum tokens.

## TL;DR

- Every command supports `--json` and `--no-interactive`
- Output is a stable API contract — schema changes are breaking changes
- Exit codes are semantic (not just 0/1)
- Errors are typed data with `recoverable` and `suggestions` fields
- `stdout` = data, `stderr` = logs/progress — never mix

---

## Five Principles

### 1. Machine-Friendly Escape Hatches

Every command must run non-interactively.

```bash
# Flags: --no-interactive, --yes, --json
# Env vars: NO_COLOR=true, TOOL_PROJECT_ID=123
```

Agents cannot respond to prompts. Interactive tools break automation.

### 2. Output as API Contracts

Output formats are versioned interfaces.

```json
{"version": "1.0", "data": {"id": "req_123", "status": 200}}
```

- Additive changes only (new fields OK, removing fields = major version bump)
- Schema validation on every release
- Version numbers in structured output

### 3. Semantic Exit Codes

| Range | Category | Agent Action |
|-------|----------|-------------|
| `0` | Success | Proceed |
| `80-89` | Input/validation errors | Fix input, don't retry |
| `90-99` | Resource/state errors | Clarify or try alternate |
| `100-109` | External/integration errors | Retry with backoff |
| `110-119` | Internal software bugs | Report bug, don't retry |

### 4. Structured Output Formats

| Flag | Format | Use Case |
|------|--------|----------|
| (default) | Structured text | Human + grep/awk |
| `--json` | JSON | Agent parsing |
| `--plain` | Tab-separated | Pipeline composition |

**Stream separation:**
- `stdout` → primary data (parseable)
- `stderr` → logs, warnings, progress (ignorable)

### 5. Real-Time Feedback

Progress on `stderr` prevents agent timeouts:

```bash
[stderr] Capturing... 15s elapsed
[stderr] Capturing... 30s complete
[stdout] {"trace_file": "/tmp/trace.json", "size_mb": 45.2}
```

---

## Dual-Mode Detection

```
if stdout.is_tty():
    # Human mode: colors, formatting
else:
    # Agent mode: structured, no colors
```

Override: `--json`, `--no-color`, `--no-interactive`

---

## Error Format

```json
{
  "error": {
    "code": 92,
    "type": "resource_not_found",
    "message": "Request req_123 not found",
    "recoverable": false,
    "retry_after": null,
    "suggestions": ["List recent: tool list --recent"]
  }
}
```

**Key rule:** Tool reports errors clearly. Tool does NOT retry — the agent decides retry strategy.

---

## Self-Describing Tools

```bash
$ tool --help-json
{
  "version": "1.2.0",
  "commands": {"get": {"flags": {"--json": "JSON output"}}},
  "exit_codes": {"0": "success", "92": "not_found"}
}
```

Agents query capabilities, not read documentation.

---

## Design Checklist

| Area | Requirement |
|------|------------|
| Commands | Each does one thing, supports `--json` and `--no-interactive` |
| Output | Data → stdout, logs → stderr, stable JSON schema with version |
| Errors | Semantic exit codes (0, 80-119), typed with `recoverable` field |
| Compose | Pipeable output, accepts stdin, single responsibility per command |
| Discovery | `--help-json` for machine-readable schema |

---

## References

- InfoQ: "Patterns for AI Agent Driven CLIs" (Aug 2025)
- Square: "Command Line Observability with Semantic Exit Codes" (Jan 2023)
- clig.dev: Command Line Interface Guidelines
