import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Pool } from 'pg';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS || '7', 10);

interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  is_active: boolean;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: Date;
}

interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
  last_activity_at: Date;
}

interface UserWithTeams {
  user: {
    id: string;
    email: string;
    username: string;
  };
  teams: {
    id: string;
    name: string;
    slug: string;
    role: string;
  }[];
}

export class AuthService {
  constructor(private pool: Pool) {}

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateSessionToken(): string {
    return `at_sess_${crypto.randomBytes(32).toString('hex')}`;
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

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

  async register(
    email: string,
    username: string,
    password: string,
    teamName?: string
  ): Promise<{ userId: string; teamId: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if email or username already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email or username already exists');
      }

      // Hash the password
      const passwordHash = await this.hashPassword(password);

      const userResult = await client.query<User>(
        `INSERT INTO users (email, username, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, username, created_at, updated_at, last_login_at, is_active`,
        [email, username, passwordHash]
      );

      const user = userResult.rows[0];

      const finalTeamName = teamName || `${username}'s Team`;
      const baseSlug = this.generateSlug(finalTeamName);
      const uniqueSlug = await this.ensureUniqueSlug(baseSlug);

      const teamResult = await client.query<Team>(
        `INSERT INTO teams (name, slug, created_by)
         VALUES ($1, $2, $3)
         RETURNING id, name, slug, created_at, updated_at, created_by`,
        [finalTeamName, uniqueSlug, user.id]
      );

      const team = teamResult.rows[0];

      await client.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [team.id, user.id, 'owner']
      );

      await client.query('COMMIT');

      return { userId: user.id, teamId: team.id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(
    emailOrUsername: string,
    password: string
  ): Promise<{ token: string; user: UserWithTeams }> {
    const client = await this.pool.connect();

    try {
      const userResult = await client.query<User>(
        `SELECT id, email, username, password_hash, is_active
         FROM users
         WHERE (email = $1 OR username = $1) AND is_active = true`,
        [emailOrUsername]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = userResult.rows[0];

      const isValid = await this.verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      await client.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      const teamsResult = await client.query(
        `SELECT t.id, t.name, t.slug, tm.role
         FROM teams t
         JOIN team_members tm ON t.id = tm.team_id
         WHERE tm.user_id = $1
         ORDER BY tm.joined_at ASC`,
        [user.id]
      );

      await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

      const token = this.generateSessionToken();
      const tokenHash = this.hashToken(token);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

      await client.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      return {
        token,
        user: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
          teams: teamsResult.rows,
        },
      };
    } finally {
      client.release();
    }
  }

  async validateSession(token: string): Promise<UserWithTeams | null> {
    const client = await this.pool.connect();

    try {
      const tokenHash = this.hashToken(token);

      const sessionResult = await client.query<Session>(
        `SELECT id, user_id, token_hash, expires_at, last_activity_at
         FROM sessions
         WHERE token_hash = $1 AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];

      await client.query(
        'UPDATE sessions SET last_activity_at = NOW() WHERE id = $1',
        [session.id]
      );

      const userResult = await client.query<User>(
        `SELECT id, email, username, is_active
         FROM users
         WHERE id = $1 AND is_active = true`,
        [session.user_id]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];

      const teamsResult = await client.query(
        `SELECT t.id, t.name, t.slug, tm.role
         FROM teams t
         JOIN team_members tm ON t.id = tm.team_id
         WHERE tm.user_id = $1
         ORDER BY tm.joined_at ASC`,
        [user.id]
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        teams: teamsResult.rows,
      };
    } finally {
      client.release();
    }
  }


  async logout(token: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const tokenHash = this.hashToken(token);

      const result = await client.query(
        'DELETE FROM sessions WHERE token_hash = $1',
        [tokenHash]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );
    return result.rowCount || 0;
  }

  async checkTeamAccess(userId: string, teamId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM team_members WHERE user_id = $1 AND team_id = $2',
      [userId, teamId]
    );
    return result.rows.length > 0;
  }

  async getUserRole(
    userId: string,
    teamId: string
  ): Promise<'owner' | 'admin' | 'member' | null> {
    const result = await this.pool.query<{ role: 'owner' | 'admin' | 'member' }>(
      'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
      [userId, teamId]
    );
    return result.rows.length > 0 ? result.rows[0].role : null;
  }
}
