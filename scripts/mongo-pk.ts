const { MongoClient } = require('mongodb')

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI not set')
  process.exit(1)
}

async function main() {
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  const action = process.argv[2]

  if (action === 'status') {
    const hash = await db.collection('serverConfig').findOne({ key: 'pk_hash' })
    console.log('PK hash:', hash?.value ?? 'none')
    const temporal = await db.collection('serverConfig').findOne({ key: 'temporal-pk' })
    console.log('Temporal PK:', temporal ? 'enabled' : 'disabled')
  } else if (action === 'clear') {
    await db.collection('serverConfig').deleteOne({ key: 'pk_hash' })
    await db.collection('serverConfig').deleteOne({ key: 'temporal-pk' })
    console.log('PK hash cleared from MongoDB')
  } else if (action === 'reset') {
    console.log('Resetting database...')
    await db.collection('projects').deleteMany({})
    await db.collection('envs').deleteMany({})
    await db.collection('apiKeys').deleteMany({})
    await db.collection('whitelist').deleteMany({})
    await db.collection('serverConfig').deleteMany({})
    console.log('All data reset - database is clean')
  } else {
    console.log('Usage: node mongo-pk.js <status|clear|reset>')
  }

  await client.close()
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
