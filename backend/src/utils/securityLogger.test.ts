import { logSecurityEvent } from './securityLogger'

describe('security logger', () => {
  it('accepts structured context without throwing', () => {
    expect(() => logSecurityEvent('auth.failure', {
      ip: '127.0.0.1',
      token: 'must-not-be-logged',
      statusCode: 401,
    })).not.toThrow()
  })
})
