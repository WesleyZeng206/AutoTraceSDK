import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthService } from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { registrationRateLimiter } from '../middleware/security';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();
  const authService = new AuthService(pool);


  router.post('/register', registrationRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, username, password, teamName } = req.body;

      // Validation
      if (!email || !username || !password) {
        return res.status(400).json({
          error: 'Missing required fields: email, username, password',
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Username validation 
      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          error: 'Invalid username: must be 3-30 characters, alphanumeric, underscore, or hyphen',
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long',
        });
      }

      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNum = /[0-9]/.test(password);
      const hasSpec = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!hasUpper || !hasLower || !hasNum || !hasSpec) {
        return res.status(400).json({
          error: 'Password must contain uppercase, lowercase, number, and special character',
        });
      }

      const { userId, teamId } = await authService.register(email, username, password, teamName);

      res.status(201).json({
        message: 'User registered successfully',
        userId,
        teamId,
      });
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.message === 'Email or username already exists') {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: 'Registration failed' });
    }
  });


  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Missing required fields: email, password',
        });
      }


      const { token, user } = await authService.login(email, password);

      const isProduction = process.env.NODE_ENV === 'production';
      // Set cookie expiration: 30 days if rememberMe is checked, otherwise 1 day
      const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      res.cookie('session_token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge,
        path: '/',
      });

      res.status(200).json({
        message: 'Login successful',
        user,
      });
    } catch (error: any) {
      console.error('Login error:', error);

      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: error.message });
      }

      res.status(500).json({ error: 'Login failed' });
    }
  });


  router.post('/logout', requireAuth(pool), async (req: Request, res: Response) => {
    try {
      const token =
        req.cookies?.session_token ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7) : null);

      if (token) {
        await authService.logout(token);
      }

      res.clearCookie('session_token', { path: '/' });

      res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });


  router.get('/me', requireAuth(pool), async (req: Request, res: Response) => {
    try {
      res.status(200).json({
        user: req.user,
        teams: req.teams,
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });


  router.post('/refresh', requireAuth(pool), async (req: Request, res: Response) => {
    try {
      res.status(200).json({
        message: 'Session is active',
        user: req.user,
        teams: req.teams,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Session refresh failed' });
    }
  });

  return router;
}
