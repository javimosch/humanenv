# 🔐 humanenv Example App

This example demonstrates how to use `humanenv` to securely retrieve and use secrets in your Node.js applications.

**Auth Method:** Fingerprint Whitelisting (no API key required)

---

## 📋 Prerequisites

1. **humanenv server running** at `http://localhost:3056`
2. **Project created** in the admin UI
3. **Some env vars set** (e.g., `api_key`, `db_host`, `db_user`, `db_pass`)
4. **Client fingerprint approved** (see Setup below)

---

## 🚀 Quick Start

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Start the Server (if not running)

```bash
cd ../../packages/server
npm run dev
```

### 3️⃣ Setup Whitelist (First Time Only)

1. Open admin UI: `http://localhost:3056`
2. Run the example once - it will show a whitelist request
3. In the UI, go to your project → Whitelist tab
4. You'll see a pending fingerprint request
5. Click **Approve**
6. Run the example again - it should work!

```bash
# Or set env vars and run directly
export HUMANENV_SERVER_URL=http://localhost:3056
export HUMANENV_PROJECT_NAME=example-app
npm start
```

---

## 🔑 Auth Methods

This example uses **whitelisting** (no API key). The client sends a fingerprint based on your machine, and the admin approves it.

**Alternative: API Key Auth**

If you prefer API keys, add to the config:

```javascript
humanenv.config({
  serverUrl: 'http://localhost:3056',
  projectName: 'example-app',
  projectApiKey: 'sk-xxx'  // Add this line
})
```

---

## 📖 What This Example Shows

### ✅ Proper Secret Handling

```javascript
// Retrieve secret
let apiKey = await humanenv.get('api_key')

// Use it immediately
callExternalService(apiKey)

// Null it from memory
apiKey = null
```

### ❌ Anti-Pattern (Don't Do this)

```javascript
// BAD: Storing in process.env defeats the purpose
process.env.API_KEY = await humanenv.get('api_key')

// BAD: Keeping reference for later use
const config = { apiKey: await humanenv.get('api_key') }
```

---

## 🧪 Example Output

```
🔐 humanenv Example App

1️⃣  Retrieving single secret...
   Got api_key: sk-xxx...
   ✅ api_key nulled from memory

2️⃣  Retrieving multiple secrets...
   db_host: localhost
   db_user: admin
   db_pass: sec...
   ✅ All secrets nulled from memory

3️⃣  Updating a secret...
   ✅ Secret updated

4️⃣  Retrieving updated secret...
   example_key: example-value-1234567890
   ✅ Secret nulled from memory

✅ Example completed successfully!
```

---

## 📁 Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies (humanenv client) |
| `index.js` | Example app with proper secret handling |
| `README.md` | This file |

---

## 🔧 Customization

Edit `index.js` to:
- Change the server URL
- Use different secret keys
- Integrate with your actual services (database, APIs, etc.)

---

## 📚 Learn More

- [humanenv README](../../README.md)
- [Client API Docs](../../packages/client/src/index.ts)

---

**Remember:** Secrets are for humans. Retrieve, use, null. 🧠
