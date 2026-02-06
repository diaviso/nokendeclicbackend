export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  app: {
    baseUrl: process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'default-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  frontend: {
    url: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10),
  },
});
