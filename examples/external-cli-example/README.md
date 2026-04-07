# humanenv Example

> Retrieve secrets securely in Node.js. Copy-paste and run.

## Prerequisites

| Requirement | How |
|------------|-----|
| humanenv server running | `npx humanenv server --port 3056` |
| Project created | Admin UI → http://localhost:3056 |
| Secrets stored | Admin UI → select project → add env vars |

## Run

```bash
npm install
export HUMANENV_SERVER_URL=http://localhost:3056
export HUMANENV_PROJECT_NAME=example-app
npm start
```

First run: a whitelist request appears in Admin UI → Whitelist tab. Approve it, then run again.

## Pattern: Retrieve, Use, Null

```javascript
import humanenv from 'humanenv'

await humanenv.config({
  serverUrl: 'http://localhost:3056',
  projectName: 'example-app',
})

// ✅ Correct: single key, use immediately, null after
let apiKey = await humanenv.get('api_key')
callExternalService(apiKey)
apiKey = null

// ✅ Correct: multiple keys
let creds = await humanenv.get(['db_host', 'db_user', 'db_pass'])
connectDB(creds.db_host, creds.db_user, creds.db_pass)
creds = null

// ❌ Wrong: storing in process.env defeats the purpose
process.env.API_KEY = await humanenv.get('api_key')
```

## With API Key Auth

```javascript
await humanenv.config({
  serverUrl: 'http://localhost:3056',
  projectName: 'example-app',
  projectApiKey: 'sk-xxx',   // skips fingerprint approval
})
```

## Expected Output

```
1. Retrieving single secret...
   Got api_key: sk-xxx...
   api_key nulled from memory

2. Retrieving multiple secrets...
   db_host: localhost
   db_user: admin
   All secrets nulled from memory

3. Updating a secret...
   Secret updated

Example completed successfully!
```
