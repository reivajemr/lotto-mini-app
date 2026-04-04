import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dbConnect from '../lib/dbConnect.js'; // <--- Agrega el .js aquí
import User from '../models/User.js';         // <--- Agrega el .js aquí también

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

export default async function handler(req, res) {
  try {
    await dbConnect();

    const usersCount = await User.estimatedDocumentCount();

    return res.status(200).json({
      success: true,
      message: 'Conexión a MongoDB Atlas exitosa.',
      usersCount,
      mongodbUri: uri ? uri.replace(/(mongodb:\/\/[^:]+):[^@]+@/, '$1:****@') : null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}