import { Express } from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { getRedisClient } from './redis.js';
import { config } from './index.js';

export const setupSession = async (app: Express): Promise<void> => {
  const redisClient = getRedisClient();
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'ledger:session:',
  });

  app.use(
    session({
      store: redisStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: 'ledger.sid',
      cookie: {
        secure: config.env === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: config.env === 'production' ? 'strict' : 'lax',
      },
    })
  );
};

