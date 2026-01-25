import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { TeamService } from '../services/teams';
import { requireAuth, requireTeamAccess, requireRole } from '../middleware/auth';

export function createTeamsRouter(pool: Pool): Router {
  const router = Router();
  const teamService = new TeamService(pool);

  router.use(requireAuth(pool));

  router.get('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const teams = await teamService.getUserTeams(req.user.id);

      res.status(200).json({ teams });
    } catch (error) {
      console.error('Get teams error:', error);
      res.status(500).json({ error: 'Failed to get teams' });
    }
  });


  router.post('/', async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { name } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      if (name.length > 255) {
        return res.status(400).json({ error: 'Team name is too long (max 255 characters)' });
      }

      const { teamId, slug } = await teamService.createTeam(name.trim(), req.user.id);

      res.status(201).json({
        message: 'Team created successfully',
        teamId,
        slug,
      });
    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({ error: 'Failed to create team' });
    }
  });


  router.get(
    '/:teamId',
    requireTeamAccess(pool),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;

        const team = await teamService.getTeamById(teamId);

        if (!team) {
          return res.status(404).json({ error: 'Team not found' });
        }

        res.status(200).json({ team });
      } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to get team' });
      }
    }
  );


  router.patch(
    '/:teamId',
    requireTeamAccess(pool),
    requireRole(['owner', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;
        const { name } = req.body;

        if (!name || name.trim().length === 0) {
          return res.status(400).json({ error: 'Team name is required' });
        }

        if (name.length > 255) {
          return res.status(400).json({ error: 'Team name is too long (max 255 characters)' });
        }

        await teamService.updateTeam(teamId, name.trim());

        res.status(200).json({ message: 'Team updated successfully' });
      } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({ error: 'Failed to update team' });
      }
    }
  );


  router.delete(
    '/:teamId',
    requireTeamAccess(pool),
    requireRole(['owner']),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;

        await teamService.deleteTeam(teamId);

        res.status(200).json({ message: 'Team deleted successfully' });
      } catch (error) {
        console.error('Delete team error:', error);
        res.status(500).json({ error: 'Failed to delete team' });
      }
    }
  );


  router.get(
    '/:teamId/members',
    requireTeamAccess(pool),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;

        const members = await teamService.getTeamMembers(teamId);

        res.status(200).json({ members });
      } catch (error) {
        console.error('Get team members error:', error);
        res.status(500).json({ error: 'Failed to get team members' });
      }
    }
  );


  router.post(
    '/:teamId/members',
    requireTeamAccess(pool),
    requireRole(['owner', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const { teamId } = req.params;
        const { email, role } = req.body;

        if (!email) {
          return res.status(400).json({ error: 'Email or username is required' });
        }

        const validRoles = ['admin', 'member'];
        const memberRole = role && validRoles.includes(role) ? role : 'member';

        const addedUser = await teamService.addMember(teamId, email, memberRole);

        res.status(201).json({
          message: 'Member added successfully',
          user: addedUser,
        });
      } catch (error: any) {
        console.error('Add member error:', error);

        if (error.message === 'User not found') {
          return res.status(404).json({ error: 'User not found' });
        }

        if (error.message === 'User is already a member of this team') {
          return res.status(409).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to add member' });
      }
    }
  );


  router.patch(
    '/:teamId/members/:userId',
    requireTeamAccess(pool),
    requireRole(['owner', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const { teamId, userId } = req.params;
        const { role } = req.body;

        const validRoles = ['admin', 'member'];
        if (!role || !validRoles.includes(role)) {
          return res.status(400).json({
            error: 'Invalid role. Must be "admin" or "member"',
          });
        }

        await teamService.updateMemberRole(teamId, userId, role, req.user!.id);

        res.status(200).json({ message: 'Member role updated successfully' });
      } catch (error: any) {
        console.error('Update member role error:', error);

        if (error.message.startsWith('Cannot update role:')) {
          return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to update member role' });
      }
    }
  );

  router.delete(
    '/:teamId/members/:userId',
    requireTeamAccess(pool),
    requireRole(['owner', 'admin']),
    async (req: Request, res: Response) => {
      try {
        const { teamId, userId } = req.params;

        await teamService.removeMember(teamId, userId, req.user!.id);

        res.status(200).json({ message: 'Member removed successfully' });
      } catch (error: any) {
        console.error('Remove member error:', error);

        if (error.message.startsWith('Cannot remove member:')) {
          return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to remove member' });
      }
    }
  );

  return router;
}
