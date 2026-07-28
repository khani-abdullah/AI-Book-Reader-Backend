import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

let isConnected = false;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri === 'your_mongodb_connection_string') {
    console.warn('[db] MONGODB_URI is not configured — RAG features require MongoDB.');
    return false;
  }

  if (isConnected) return true;

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('[db] Connected to MongoDB');
    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    return false;
  }
}

export function isDBReady() {
  return isConnected && mongoose.connection.readyState === 1;
}
