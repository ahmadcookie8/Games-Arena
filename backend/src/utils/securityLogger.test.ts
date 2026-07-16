jest.mock('winston', () => ({
  __esModule: true,
  default: {
    createLogger: jest.fn(() => ({ log: jest.fn() })),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
    },
    transports: { Console: jest.fn() },
  },
}))

import winston from 'winston'
import { logSecurityEvent } from './securityLogger'

function loggerLog(): jest.Mock {
  const createLogger = winston.createLogger as jest.Mock
  return createLogger.mock.results[0].value.log as jest.Mock
}

describe('security logger', () => {
  beforeEach(() => loggerLog().mockClear())

  it('accepts structured context without throwing', () => {
    expect(() => logSecurityEvent('auth.failure', {
      ip: '127.0.0.1',
      token: 'must-not-be-logged',
      statusCode: 401,
    })).not.toThrow()
  })

  it('does not let context replace reserved log metadata', () => {
    logSecurityEvent('socket.malformed_event', {
      event: 'attacker-controlled-event',
      level: 'info',
      message: 'must-not-be-logged',
      timestamp: 'attacker-controlled-time',
      socketEvent: 'makeMove',
      socketId: 'socket-1',
    }, 'error')

    expect(loggerLog()).toHaveBeenCalledWith('error', 'security_event', {
      event: 'socket.malformed_event',
      socketEvent: 'makeMove',
      socketId: 'socket-1',
    })
  })
})
