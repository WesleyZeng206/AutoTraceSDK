import { Pool } from 'pg';
import crypto from 'crypto';

interface Team {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Date;
}

interface TeamWithMembers extends Team {
  members: {
    user_id: string;
    email: string;
    username: string;
    role: string;
    joined_at: Date;
  }[];
}

export class TeamService {
  constructor(private pool: Pool) {}

  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 100);
  }

  async ensureUniqueSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let attempt = 0;
    const maxAttempts = 10;

    while (attempt < maxAttempts) {
      const result = await this.pool.query(
        'SELECT 1 FROM teams WHERE slug = $1',
        [slug]
      );

      if (result.rows.length === 0) {
        return slug;
      }

      const suffix = crypto.randomBytes(3).toString('hex');
      slug = `${baseSlug}-${suffix}`;
      attempt++;
    }

    throw new Error('Failed to generate unique slug');
  }

  async createTeam(
    name: string,
    createdBy: string
  ): Promise<{ teamId: string; slug: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const baseSlug = this.generateSlug(name);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

      const teamResult = await client.query<Team>(
        `INSERT INTO teams (name, slug, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, name, slug, created_at, updated_at, created_by`,
        [name, uniqueSlug, createdBy]
      );

      const team = teamResult.rows[0];

      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [team.id, createdBy, 'owner']
      );

      await client.query('COMMIT');

      return { teamId: team.id, slug: team.slug };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    const result = await this.pool.query<Team>(
      `SELECT id, name, slug, created_at, updated_at, created_by
       FROM teams
       WHERE id = $1`,
      [teamId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
    const client = await this.pool.connect();

    try {
      const teamResult = await client.query<Team>(
        `SELECT id, name, slug, created_at, updated_at, created_by
         FROM teams
         WHERE id = $1`,
        [teamId]
      );

      if (teamResult.rows.length === 0) {
        return null;
      }

      const team = teamResult.rows[0];

      const membersResult = await client.query(
        `SELECT u.id as user_id, u.email, u.username, tm.role, tm.joined_at
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1
         ORDER BY tm.joined_at ASC`,
        [teamId]
      );

      return {
        ...team,
        members: membersResult.rows,
      };
    } finally {
      client.release();
    }
  }

  async getUserTeams(userId: string): Promise<
    {
      id: string;
      name: string;
      slug: string;
      role: string;
      joined_at: Date;
      member_count: number;
    }[]
  > {
    const result = await this.pool.query(
      `SELECT
        t.id,
        t.name,
        t.slug,
        tm.role,
        tm.joined_at,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1
       ORDER BY tm.joined_at ASC`,
      [userId]
    );

    return result.rows;
  }

  async updateTeam(teamId: string, name: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const currentTeam = await this.getTeamById(teamId);
      if (!currentTeam) {
        throw new Error('Team not found');
      }

      let newSlug = currentTeam.slug;
      if (name !== currentTeam.name) {
        const baseSlug = this.generateSlug(name);
        newSlug = await this.ensureUniqueSlug(baseSlug);
      }

      await client.query(
        `UPDATE teams
         SET name = $1, slug = $2, updated_at = NOW()
         WHERE id = $3`,
        [name, newSlug, teamId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteTeam(teamId: string): Promise<void> {
    await this.pool.query('DELETE FROM teams WHERE id = $1', [teamId]);
  }

  async addMember(
    teamId: string,
    emailOrUsername: string,
    role: 'admin' | 'member' = 'member'
  ): Promise<{ userId: string; email: string; username: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `SELECT id, email, username
         FROM users
         WHERE (email = $1 OR username = $1) AND is_active = true`,
        [emailOrUsername]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      const existingMember = await client.query(
        'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, user.id]
      );

      if (existingMember.rows.length > 0) {
        throw new Error('User is already a member of this team');
      }

      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [teamId, user.id, role]
      );

      await client.query('COMMIT');

      return {
        userId: user.id,
        email: user.email,
        username: user.username,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMemberRole( teamId: string, userId: string, role: 'admin' | 'member', actorId: string): Promise<void> {
    const actor = await this.pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, actorId]
    );

    const target = await this.pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (actor.rows.length === 0 || target.rows.length === 0) {
      throw new Error('Cannot update role: member not found');
    }

    const aRole = actor.rows[0].role;
    const tRole = target.rows[0].role;

    if (tRole === 'owner') {
      throw new Error('Cannot update role: cannot modify owner');
    }

    if (aRole === 'admin' && tRole === 'admin') {
      throw new Error('Cannot update role: admins cannot modify other admins');
    }

    await this.pool.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`,
      [role, teamId, userId]
    );
  }

  async removeMember(teamId: string, userId: string, actorId: string): Promise<void> {
    const actor = await this.pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, actorId]
    );

    const target = await this.pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (actor.rows.length === 0 || target.rows.length === 0) {
      throw new Error('Cannot remove member: not found');
    }

    const aRole = actor.rows[0].role;
    const tRole = target.rows[0].role;

    if (tRole === 'owner') {
      throw new Error('Cannot remove member: cannot remove owner');
    }

    if (aRole === 'admin' && tRole === 'admin') {
      throw new Error('Cannot remove member: admins cannot remove other admins');
    }

    await this.pool.query(
      `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
  }

  async getTeamMembers(teamId: string): Promise<
    {
      user_id: string;
      email: string;
      username: string;
      role: string;
      joined_at: Date;
      last_login_at: Date | null;
    }[]
  > {
    const result = await this.pool.query(
      `SELECT u.id as user_id,
        u.email,
        u.username,
        tm.role,
        tm.joined_at,
        u.last_login_at
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY
         CASE tm.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'member' THEN 3
         END,
         tm.joined_at ASC`,
      [teamId]
    );

    return result.rows;
  }

  async isOwner(teamId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM team_members
       WHERE team_id = $1 AND user_id = $2 AND role = 'owner'`,
      [teamId, userId]
    );

    return result.rows.length > 0;
  }


  async isOwnerOrAdmin(teamId: string, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM team_members
       WHERE team_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')`,
      [teamId, userId]
    );

    return result.rows.length > 0;
  }
}
