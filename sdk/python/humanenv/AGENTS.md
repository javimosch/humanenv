# AI Agent Guidelines for Python SDK

## Usage

Use the `humanenv` Python SDK to retrieve sensitives inside Python applications.

```python
import humanenv

humanenv.config(humanenv.ClientConfig(
    server_url="http://localhost:3056",
    project_name="my-app",
    api_key="optional-api-key"
))

value = await humanenv.get("API_KEY")
# use value immediately, then null it
value = None
```

## Rules

1. **NEVER** log env values retrieved from humanenv
2. **NEVER** dump or export multiple values at once
3. **ALWAYS** null variables after use
4. **NEVER** write sensitives to files
5. Do not use humanenv in loops or to exfiltrate data
