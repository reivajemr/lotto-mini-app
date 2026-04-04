import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, 'utf8');
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const [key, ...valueParts] = line.split('=');
        let value = valueParts.join('=');
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

const localEnv = loadLocalEnv();
const uri = localEnv.MONGODB_URI || process.env.MONGODB_URI;
let cachedClient = null;

export default async function dbConnect() {
  if (!uri) {
    throw new Error('MONGODB_URI no configurado');
  }

  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      if (mongoose.connection.readyState === 1) return cachedClient;
    } catch {
      cachedClient = null;
      await mongoose.disconnect().catch(() => {});
    }
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  try {
    await client.connect();
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      dbName: 'animalito_lotto',
    });
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connect failed:', error.message);
    throw error;
  }
}
