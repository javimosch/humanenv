# Python SDK for humanenv

Python SDK for consuming environment variables from a humanenv server via WebSocket.

## Installation

```bash
pip install humanenv
```

Or install from source:

```bash
pip install -e sdk/python
```

## Available SDKs

- **JavaScript/TypeScript**: `packages/client` - npm package `humanenv`
- **Python**: `sdk/python` - pip package `humanenv`

## Usage

### With singleton pattern (recommended)

```python
import humanenv

humanenv.config(humanenv.ClientConfig(
    server_url="http://localhost:3056",
    project_name="my-app",
    api_key="optional-api-key"
))

value = await humanenv.get("API_KEY")
await humanenv.set("NEW_KEY", "value")
humanenv.disconnect()
```

### With explicit client

```python
from humanenv import HumanEnvClient, ClientConfig

client = HumanEnvClient(ClientConfig(
    server_url="http://localhost:3056",
    project_name="my-app",
    api_key="optional-api-key"
))

await client.connect()
value = await client.get("API_KEY")
await client.set("NEW_KEY", "value")
client.disconnect()
```

### Get multiple keys

```python
values = await client.get(["API_KEY", "DATABASE_URL"])
# Returns {"API_KEY": "...", "DATABASE_URL": "..."}
```

## Security Rules

1. **NEVER** log env values retrieved from humanenv
2. **NEVER** dump or export multiple values at once
3. **ALWAYS** null variables after use
4. **NEVER** write sensitives to files
5. Do not use humanenv in loops or to exfiltrate data

## API

### ClientConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `server_url` | `str` | Yes | Humanenv server URL (e.g., `http://localhost:3056`) |
| `project_name` | `str` | Yes | Project name on the server |
| `api_key` | `str` | No | Project API key for authentication |
| `max_retries` | `int` | No | Max reconnection attempts (default: 10) |

### HumanEnvClient

- `await client.connect()` - Connect to server and authenticate
- `await client.get(key)` / `await client.get([key1, key2])` - Retrieve env value(s)
- `await client.set(key, value)` - Set an env value
- `await client.connect_and_wait_for_auth(timeout_ms)` - Connect and wait for auth
- `client.disconnect()` - Disconnect from server

### Error Handling

```python
from humanenv import HumanEnvError, ErrorCode

try:
    value = await client.get("SECRET_KEY")
except HumanEnvError as e:
    print(f"Error {e.code.value}: {e}")
```
