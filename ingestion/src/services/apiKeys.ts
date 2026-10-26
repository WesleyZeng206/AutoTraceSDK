import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';

interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  name: string | null;
  user_id: string;
  team_id: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
}

interface ApiKeyValidationResult {
  valid: boolean;
  teamId?: string;
  userId?: string;
  keyId?: string;
}

export class ApiKeyService {
  constructor(private pool: Pool) {}


  generateKey(environment: 'live' | 'test' = 'live'): string {
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `at_${environment}_${randomPart}`;
  }

  /**
   * Extract prefix from API key 
   */
  extractPrefix(key: string): string {
    return key.substring(0, 12);
  }

  /**
   * Hash API key for storage
   */
  async hashKey(key: string): Promise<string> {
    return bcrypt.hash(key, config.security.bcryptRounds);
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    userId: string,
    teamId: string,
    name: string,
    expiresInDays?: number,
    environment: 'live' | 'test' = 'live'
  ): Promise<{ key: string; keyId: string; prefix: string }> {
    const client = await this.pool.connect();

    try {
      const key = this.generateKey(environment);
      const keyHash = await this.hashKey(key);
      const keyPrefix = this.extractPrefix(key);

      let expiresAt: Date | null = null;
      if (expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      }

      const result = await client.query<ApiKey>(
        `INSERT INTO api_keys (key_hash, key_prefix, name, user_id, team_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [keyHash, keyPrefix, name, userId, teamId, expiresAt]
      );

      const keyId = result.rows[0].id;

      return {
        key, 
        keyId,
        prefix: keyPrefix,
      };
    } finally {
      client.release();
    }
  }

  async validateKey(key: string): Promise<ApiKeyValidationResult> {
    const client = await this.pool.connect();

    try {
      if (!key.startsWith('at_')) {
        return { valid: false };
      }

      const keyPrefix = this.extractPrefix(key);

      const keysResult = await client.query<ApiKey>(
        `SELECT id, key_hash, user_id, team_id, expires_at
         FROM api_keys
         WHERE key_prefix = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [keyPrefix]
      );

      let matchedKey: ApiKey | null = null;
      for (const apiKey of keysResult.rows) {
        const isMatch = await bcrypt.compare(key, apiKey.key_hash);
        if (isMatch) {
          matchedKey = apiKey;
          break;
        }
      }

      if (!matchedKey) {
        return { valid: false };
      }

      await client.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [matchedKey.id]
      );

      return {
        valid: true,
        teamId: matchedKey.team_id,
        userId: matchedKey.user_id,
        keyId: matchedKey.id,
      };
    } finally {
      client.release();
    }
  }

  async getUserApiKeys(userId: string, teamId?: string): Promise<
    {
      id: string;
      prefix: string;
      name: string | null;
      team_id: string;
      team_name: string;
      created_at: Date;
      last_used_at: Date | null;
      expires_at: Date | null;
      is_active: boolean;
    }[]
  > {
    let query = `
      SELECT k.id,
        k.key_prefix as prefix,
        k.name,
        k.team_id,
        t.name as team_name,
        k.created_at,
        k.last_used_at,
        k.expires_at,
        k.is_active
      FROM api_keys k
      JOIN teams t ON k.team_id = t.id
      WHERE k.user_id = $1
    `;

    const params: any[] = [userId];

    if (teamId) {
      query += ' AND k.team_id = $2';
      params.push(teamId);
    }

    query += ' ORDER BY k.created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async getTeamApiKeys(teamId: string): Promise<
    {
      id: string;
      prefix: string;
      name: string | null;
      user_id: string;
      user_email: string;
      user_username: string;
      created_at: Date;
      last_used_at: Date | null;
      expires_at: Date | null;
      is_active: boolean;
    }[]
  > {
    const result = await this.pool.query(
      `SELECT k.id,
        k.key_prefix as prefix,
        k.name,
        k.user_id,
        u.email as user_email,
        u.username as user_username,
        k.created_at,
        k.last_used_at,
        k.expires_at,
        k.is_active
      FROM api_keys k
      JOIN users u ON k.user_id = u.id
      WHERE k.team_id = $1
      ORDER BY k.created_at DESC`,
      [teamId]
    );

    return result.rows;
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET is_active = false
       WHERE id = $1 AND user_id = $2`,
      [keyId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('API key not found or unauthorized');
    }
  }


  async revokeApiKeyByAdmin(keyId: string, teamId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET is_active = false
       WHERE id = $1 AND team_id = $2`,
      [keyId, teamId]
    );

    if (result.rowCount === 0) {
      throw new Error('API key not found');
    }
  }


  async updateApiKeyName(keyId: string, userId: string, name: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE api_keys
       SET name = $1
       WHERE id = $2 AND user_id = $3`,
      [name, keyId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('API key not found or unauthorized');
    }
  }


  async deleteExpiredKeys(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM api_keys
       WHERE expires_at < NOW()`
    );

    return result.rowCount || 0;
  }
}
