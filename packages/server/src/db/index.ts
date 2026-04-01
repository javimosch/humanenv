import { IDatabaseProvider } from './interface'
import { SqliteProvider } from './sqlite'
import { MongoProvider } from './mongo'

export async function createDatabase(dataDir: string, mongoUri?: string): Promise<{ provider: IDatabaseProvider; active: 'sqlite' | 'mongodb' }> {
  if (mongoUri) {
    try {
      const mongo = new MongoProvider(mongoUri)
      await mongo.connect()
      return { provider: mongo, active: 'mongodb' }
    } catch (e) {
      console.warn('WARN:', (e as Error).message + '\nFalling back to SQLite.')
    }
  }

  const sqlite = new SqliteProvider(dataDir)
  await sqlite.connect()
  return { provider: sqlite, active: 'sqlite' }
}
