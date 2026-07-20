# Python SDK for humanenv

Python SDK for retrieving secrets from a humanenv server via WebSocket.

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
import asyncio
import humanenv

async def main():
    humanenv.config(humanenv.ClientConfig(
        server_url="http://localhost:3056",
        project_name="my-app",
        api_key="optional-api-key"
    ))

    value = await humanenv.get("API_KEY")
    await humanenv.set("NEW_KEY", "value")
    humanenv.disconnect()

asyncio.run(main())
```

### With explicit client

```python
import asyncio
from humanenv import HumanEnvClient, ClientConfig

async def main():
    client = HumanEnvClient(ClientConfig(
        server_url="http://localhost:3056",
        project_name="my-app",
        api_key="optional-api-key"
    ))

    await client.connect()
    value = await client.get("API_KEY")
    await client.set("NEW_KEY", "value")
    client.disconnect()

asyncio.run(main())
```

### Get multiple keys

```python
import asyncio
from humanenv import HumanEnvClient, ClientConfig

async def main():
    client = HumanEnvClient(ClientConfig(
        server_url="http://localhost:3056",
        project_name="my-app",
    ))
    await client.connect()
    values = await client.get(["API_KEY", "DATABASE_URL"])
    # Returns {"API_KEY": "...", "DATABASE_URL": "..."}
    client.disconnect()

asyncio.run(main())
```

## Security Rules

1. **NEVER** log secret values retrieved from humanenv
2. **NEVER** log or persist multiple values at once (use multi-key `get` only when needed, then null)
3. **ALWAYS** set variables to `None` after use
4. **NEVER** write secrets to files
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
- `await client.get(key)` / `await client.get([key1, key2])` - Retrieve secret(s)
- `await client.set(key, value)` - Set a secret
- `await client.connect_and_wait_for_auth(timeout_ms)` - Connect and wait for auth
- `client.disconnect()` - Disconnect from server

### Module-level API (singleton)

Used with `humanenv.config()` — see [With singleton pattern](#with-singleton-pattern-recommended) above.

- `humanenv.config(cfg: ClientConfig) -> None` - Configure the singleton client (call once before get/set)
- `await humanenv.get(key: str) -> str` - Retrieve a secret via the singleton client
- `await humanenv.set(key: str, value: str) -> None` - Set a secret via the singleton client
- `humanenv.disconnect() -> None` - Disconnect and reset the singleton client

### Error Handling

```python
import asyncio
from humanenv import HumanEnvClient, ClientConfig, HumanEnvError, ErrorCode

async def main():
    client = HumanEnvClient(ClientConfig(
        server_url="http://localhost:3056",
        project_name="my-app",
    ))
    await client.connect()
    try:
        value = await client.get("SECRET_KEY")
    except HumanEnvError as e:
        print(f"Error {e.code.value}: {e}")
    finally:
        client.disconnect()

asyncio.run(main())
```
