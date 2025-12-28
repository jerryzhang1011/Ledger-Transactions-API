import { Express } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from './index.js';
import { UserModel } from '../models/user.model.js';
import { AccountModel } from '../models/account.model.js';
import { User } from '../types/database.js';
import { logger } from '../utils/logger.js';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
    }
  }
}

export const setupPassport = (app: Express): void => {
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user to session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await UserModel.findById(id);
      if (user) {
        done(null, { id: user.id, email: user.email, name: user.name });
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error, false);
    }
  });

  // Google OAuth Strategy
  if (config.google.clientId && config.google.clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: config.google.callbackUrl,
          scope: ['profile', 'email'],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: Profile,
          done: (error: Error | null, user?: Express.User | false) => void
        ) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'), false);
            }

            const { user, isNew } = await UserModel.findOrCreate({
              email,
              name: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
              provider: 'google',
              providerId: profile.id,
            });

            // Create default account for new users
            if (isNew) {
              await AccountModel.create({
                userId: user.id,
                name: 'Default Account',
                currency: 'USD',
                initialBalance: 0,
              });
              logger.info({ userId: user.id }, 'Created new user and default account');
            }

            return done(null, { id: user.id, email: user.email, name: user.name });
          } catch (error) {
            logger.error({ error }, 'Google OAuth error');
            return done(error as Error, false);
          }
        }
      )
    );
  } else {
    logger.warn('Google OAuth credentials not configured');
  }
};

