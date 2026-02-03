import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ApiKeyService } from '../services/apiKeys';
import { requireAuth, requireTeamAccess, requireRole } from '../middleware/auth';

export function createApiKeysRouter(pool: Pool): Router {
  const router = Router();
  const apiKeyService = new ApiKeyService(pool);

  const noStore = function (res: Response) { 
    res.setHeader('Cache-Control', 'no-store'); 
  }

  router.use(requireAuth(pool));
  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { teamId, name, expiresInDays, environment } = req.body;

      if (!teamId) {
        return res.status(400).json({ error: 'teamId is required' });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'name is required' });
      }

      // Verify user has access to the team
      const hasAccess = req.teams?.some((team) => team.id === teamId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this team' });
      }

      // Create API key
      const { key, keyId, prefix } = await apiKeyService.createApiKey(
        req.user.id,
        teamId,
        name.trim(),
        expiresInDays,
        environment || 'live'
      );

      noStore(res);
      
      res.status(201).json({
        message: 'API key created successfully',
        keyId,
        key, // Full key only shown wehn created
        prefix,
        warning: 'Save this key now because you will not be able to see it again',
      });
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { teamId } = req.query;

      if (teamId) {
        const hasAccess = req.teams?.some((team) => team.id === teamId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'You do not have access to this team' });
        }
      }

      const apiKeys = await apiKeyService.getUserApiKeys(
        req.user.id,
        teamId as string | undefined
      );

      noStore(res);
      res.status(200).json({ apiKeys });
    } catch (error) {
      console.error('Get API keys error:', error);
      res.status(500).json({ error: 'Failed to get API keys' });
    }
  });

  router.get('/teams/:teamId', requireTeamAccess(pool), requireRole(['owner', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;

        const apiKeys = await apiKeyService.getTeamApiKeys(teamId);

        noStore(res);
        res.status(200).json({ apiKeys });
      } catch (error) {
        console.error('Get team API keys error:', error);
        res.status(500).json({ error: 'Failed to get team API keys' });
      }
    }
  );


  router.delete('/:keyId', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { keyId } = req.params;

      await apiKeyService.revokeApiKey(keyId, req.user.id);

      res.status(200).json({ message: 'API key revoked successfully' });
    } catch (error: any) {
      console.error('Revoke API key error:', error);

      if (error.message === 'API key not found or unauthorized') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });


  router.patch('/:keyId', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { keyId } = req.params;
      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'name is required' });
      }

      await apiKeyService.updateApiKeyName(keyId, req.user.id, name.trim());

      res.status(200).json({ message: 'API key updated successfully' });
    } catch (error: any) {
      console.error('Update API key error:', error);

      if (error.message === 'API key not found or unauthorized') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Failed to update API key' });
    }
  });

  return router;
}
