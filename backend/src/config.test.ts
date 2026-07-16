describe('production configuration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('dotenv', () => ({
      __esModule: true,
      default: { config: jest.fn() },
    }))
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://database/games',
      REDIS_URL: 'redis://cache:6379',
      CORS_ORIGIN: 'https://games.penguincookie.ca',
      JWT_SECRET: 'a'.repeat(32),
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('requires a configured 256-bit JWT secret', () => {
    delete process.env.JWT_SECRET
    expect(() => require('./config')).toThrow('JWT_SECRET is required in production')
  })

  it('rejects a short JWT secret', () => {
    process.env.JWT_SECRET = 'too-short'
    expect(() => require('./config')).toThrow('JWT_SECRET must contain at least 32 bytes in production')
  })

  it('requires the production browser origin to use HTTPS', () => {
    process.env.CORS_ORIGIN = 'http://games.penguincookie.ca'
    expect(() => require('./config')).toThrow('CORS_ORIGIN must use HTTPS in production')
  })

  it('requires the canonical production browser origin', () => {
    process.env.CORS_ORIGIN = 'https://games-arena.penguincookie.ca'
    expect(() => require('./config')).toThrow('CORS_ORIGIN must be https://games.penguincookie.ca in production')
  })

  it('rejects unknown NODE_ENV values instead of bypassing production safeguards', () => {
    process.env.NODE_ENV = 'prodution'
    expect(() => require('./config')).toThrow('NODE_ENV must be one of: development, test, production')
  })
})
