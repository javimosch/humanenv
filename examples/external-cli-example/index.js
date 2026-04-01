/**
 * humanenv Example App
 * 
 * This app demonstrates the proper way to retrieve and use secrets
 * with humanenv. Notice how we null variables immediately after use.
 * 
 * This example uses WHITELISTING only (no API key required).
 * Make sure your client fingerprint is approved in the admin UI.
 */

const humanenv = require('humanenv').default

// Configure humanenv client
// NOTE: No projectApiKey needed - uses fingerprint whitelisting
humanenv.config({
  serverUrl: process.env.HUMANENV_SERVER_URL || 'http://localhost:3056',
  projectName: process.env.HUMANENV_PROJECT_NAME || 'example-app'
  // projectApiKey is OPTIONAL - omit for whitelist-only auth
})

async function main() {
  console.log('🔐 humanenv Example App\n')

  // Example 1: Single secret retrieval
  console.log('1️⃣  Retrieving single secret...')
  let apiKey = await humanenv.get('api_key')
  console.log(`   Got api_key: ${apiKey ? apiKey.slice(0, 8) + '...' : 'undefined'}`)
  
  // Use the secret immediately
  // simulateApiCall(apiKey)
  
  // IMPORTANT: Null it after use
  apiKey = null
  console.log('   ✅ api_key nulled from memory\n')

  // Example 2: Multiple secrets retrieval
  console.log('2️⃣  Retrieving multiple secrets...')
  let { db_host, db_user, db_pass } = await humanenv.get([
    'db_host',
    'db_user',
    'db_pass'
  ])
  
  console.log(`   db_host: ${db_host || 'undefined'}`)
  console.log(`   db_user: ${db_user || 'undefined'}`)
  console.log(`   db_pass: ${db_pass ? db_pass.slice(0, 4) + '...' : 'undefined'}`)
  
  // Use secrets immediately
  // connectToDatabase(db_host, db_user, db_pass)
  
  // IMPORTANT: Null them after use
  db_host = null
  db_user = null
  db_pass = null
  console.log('   ✅ All secrets nulled from memory\n')

  // Example 3: Set a secret
  console.log('3️⃣  Updating a secret...')
  await humanenv.set('example_key', 'example-value-' + Date.now())
  console.log('   ✅ Secret updated\n')

  // Example 4: Retrieve the secret we just set
  console.log('4️⃣  Retrieving updated secret...')
  let exampleValue = await humanenv.get('example_key')
  console.log(`   example_key: ${exampleValue || 'undefined'}`)
  exampleValue = null
  console.log('   ✅ Secret nulled from memory\n')

  console.log('✅ Example completed successfully!')
  
  // Disconnect from server
  await humanenv.disconnect()
}

// Handle errors gracefully
main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
