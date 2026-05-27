import mongoose from 'mongoose'
import { config } from '../config'

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri)
    console.log('MongoDB connected')
  } catch (err) {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1
}
