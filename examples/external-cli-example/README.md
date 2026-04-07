# humanenv Example App

Demonstrates secure secret retrieval with `humanenv` in Node.js using fingerprint whitelisting.

## Prerequisites

- humanenv server running at `http://localhost:3056`
- Project created in admin UI
- Env vars set (e.g., `api_key`, `db_host`, `db_user`, `db_pass`)

## Run

```bash
npm install
export HUMANENV_SERVER_URL=http://localhost:3056
export HUMANENV_PROJECT_NAME=example-app
npm start
```

First run triggers a whitelist request. Approve it in the admin UI → Whitelist tab, then run again.

## Usage Pattern

```javascript
// Correct: retrieve, use, null
let apiKey = await humanenv.get('api_key')
callExternalService(apiKey)
apiKey = null

// WRONG: storing in process.env defeats the purpose
process.env.API_KEY = await humanenv.get('api_key')
```

## API Key Auth (Alternative)

```javascript
humanenv.config({
  serverUrl: 'http://localhost:3056',
  projectName: 'example-app',
  projectApiKey: 'sk-xxx'
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

4. Retrieving updated secret...
   example_key: example-value-1234567890

Example completed successfully!
```
