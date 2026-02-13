import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthService } from '../services/auth';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter, registrationRateLimiter } from '../middleware/security';
import { validateLoginInput, validateRegisterInput } from '../utils/authValidation';

export function createAuthRouter(pool: Pool): Router {
  const router = Router();
  const authService = new AuthService(pool);
  const ns = (res: Response) => res.setHeader('Cache-Control', 'no-store');


  router.post('/register', registrationRateLimiter, async (req: Request, res: Response) => {
    try {
      const regCheck = validateRegisterInput(req.body);
      
      if (!regCheck.ok) {
        return res.status(400).json({ error: regCheck.error });
      }

      const { email, username, password, teamName } = regCheck.value;
      const { userId, teamId } = await authService.register(email, username, password, teamName);

      res.status(201).json({ message: 'User registered successfully', userId, teamId });

    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.message === 'Email or username already exists') {
        return res.status(409).json({ error: error.message });
      }

      res.status(500).json({ error: 'Registration failed' });
    }
  });


  router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
    try {
      const loginCheck = validateLoginInput(req.body);
      if (!loginCheck.ok) {
        return res.status(400).json({ error: loginCheck.error });
      }

      const { emailOrUsername, password, rememberMe } = loginCheck.value;
      const { token, user } = await authService.login(emailOrUsername, password);

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

      ns(res);
      res.status(200).json({ message: 'Login successful', user });
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
      ns(res);
      res.status(200).json({ user: req.user, teams: req.teams });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });


  router.post('/refresh', requireAuth(pool), async (req: Request, res: Response) => {
    try {
      ns(res);
      res.status(200).json({ message: 'Session is active', user: req.user, teams: req.teams });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Session refresh failed' });
    }
  });

  return router;
}
