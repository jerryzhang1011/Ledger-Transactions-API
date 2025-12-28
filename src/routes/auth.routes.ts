import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { requireAuth } from '../middlewares/auth.js';
import { UserModel } from '../models/user.model.js';
import { config } from '../config/index.js';

const router = Router();

// Apply rate limiting to auth routes
router.use(authRateLimiter);

// GET /auth/google - Initiate Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// GET /auth/google/callback - Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure',
    session: true,
  }),
  (_req: Request, res: Response) => {
    // Successful authentication
    res.redirect('/auth/success');
  }
);

// GET /auth/success - OAuth success page
router.get('/success', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({
      success: true,
      message: 'Authentication successful',
      user: req.user,
    });
  } else {
    res.redirect('/auth/google');
  }
});

// GET /auth/failure - OAuth failure page
router.get('/failure', (_req: Request, res: Response) => {
  res.status(401).json({
    success: false,
    error: {
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
    },
  });
});

// GET /auth/me - Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: UserModel.toResponse(user),
  });
});

// POST /auth/logout - Logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('ledger.sid');
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });
});

// For development: mock login endpoint
if (config.env !== 'production') {
  router.post('/dev-login', async (req: Request, res: Response) => {
    const { email, name } = req.body as { email?: string; name?: string };

    if (!email) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email is required' },
      });
      return;
    }

    const { AccountModel } = await import('../models/account.model.js');
    const { user, isNew } = await UserModel.findOrCreate({
      email,
      name: name || 'Dev User',
      provider: 'dev',
      providerId: `dev-${email}`,
    });

    if (isNew) {
      await AccountModel.create({
        userId: user.id,
        name: 'Default Account',
        currency: 'USD',
        initialBalance: 10000, // $100 for testing
      });
    }

    req.login({ id: user.id, email: user.email, name: user.name }, (err) => {
      if (err) {
        res.status(500).json({
          success: false,
          error: { code: 'LOGIN_ERROR', message: 'Failed to create session' },
        });
        return;
      }

      res.json({
        success: true,
        data: UserModel.toResponse(user),
      });
    });
  });
}

export default router;

