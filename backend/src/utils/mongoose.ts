import mongoose from 'mongoose'
import { config } from '../config'
import { logSecurityEvent } from './securityLogger'

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri)
    logSecurityEvent('mongodb.connected', {}, 'info')
  } catch (err) {
    logSecurityEvent('mongodb.connection_failed', {
      errorName: err instanceof Error ? err.name : 'UnknownError',
    }, 'error')
    throw new Error('MongoDB connection failed')
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1
}
