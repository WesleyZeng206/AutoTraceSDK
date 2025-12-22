import { Pool } from 'pg';
import type { TelemetryEvent } from '@autotrace/telemetry';

interface QueryFilters {
  service?: string;
  route?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export class StorageService {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not configured. Set the environment variable before starting the ingestion service.');
    }

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      console.log('Database connection confirmed');
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  }

  async insertEvent(event: TelemetryEvent): Promise<void> {
    const sql = `
      INSERT INTO requests_raw (
        request_id, service_name, route, method, status_code,
        duration_ms, timestamp, error_type, error_message, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (request_id) DO NOTHING
    `;

    await this.pool.query(sql, [
      event.request_id,
      event.service_name,
      event.route,
      event.method,
      event.status_code,
      event.duration_ms,
      event.timestamp,
      event.error_type || null,
      event.error_message || null,
      this.serializeMetadata(event.metadata)
    ]);
  }

  async insertBatch(events: TelemetryEvent[]): Promise<void> {
    if (events.length === 0) return;

    const columnsPerRow = 10;
    const values: Array<string | number | null> = [];
    const rows = events.map((event, idx) => {
      const baseIndex = idx * columnsPerRow;
      values.push( event.request_id, event.service_name, event.route, event.method, event.status_code,
        event.duration_ms,
        event.timestamp,
        event.error_type || null,
        event.error_message || null,
        this.serializeMetadata(event.metadata)
      );
      const placeholders = Array.from({ length: columnsPerRow }, (_, offset) => `$${baseIndex + offset + 1}`);
      return `(${placeholders.join(', ')})`;
    });

    const sql = `
      INSERT INTO requests_raw (
        request_id, service_name, route, method, status_code,
        duration_ms, timestamp, error_type, error_message, metadata
      ) VALUES ${rows.join(', ')}
      ON CONFLICT (request_id) DO NOTHING
    `;

    await this.pool.query(sql, values);
  }

  async queryEvents(filters: QueryFilters): Promise<TelemetryEvent[]> {
    const clauses: string[] = [];
    const values: Array<string | number> = [];
    let paramIndex = 1;

    const addClause = (fragment: string, value: string | number) => {
      clauses.push(`${fragment} $${paramIndex}`);
      values.push(value);
      paramIndex += 1;
    };

    if (filters.service) addClause('service_name =', filters.service);
    if (filters.route) addClause('route =', filters.route);
    if (filters.startTime) addClause('timestamp >=', filters.startTime.toISOString());
    if (filters.endTime) addClause('timestamp <=', filters.endTime.toISOString());

    let sql = 'SELECT * FROM requests_raw';
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ' ORDER BY timestamp DESC';

    if (typeof filters.limit === 'number') {
      sql += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
      paramIndex += 1;
    }

    if (typeof filters.offset === 'number' && filters.offset > 0) {
      sql += ` OFFSET $${paramIndex}`;
      values.push(filters.offset);
    }

    const result = await this.pool.query(sql, values);
    return result.rows;
  }

  async computeHourlyAggregates(startTime: Date, endTime: Date): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO aggregated_metrics_hourly (
          service_name, route, time_bucket, request_count, error_count,
          avg_latency, p50_latency, p95_latency, p99_latency
        )
        SELECT
          service_name,
          route,
          date_trunc('hour', timestamp) as time_bucket,
          COUNT(*) as request_count,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count,
          AVG(duration_ms) as avg_latency,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_latency
        FROM requests_raw
        WHERE timestamp >= $1 AND timestamp < $2
        GROUP BY service_name, route, time_bucket
        ON CONFLICT (service_name, route, time_bucket)
        DO UPDATE SET
          request_count = EXCLUDED.request_count,
          error_count = EXCLUDED.error_count,
          avg_latency = EXCLUDED.avg_latency,
          p50_latency = EXCLUDED.p50_latency,
          p95_latency = EXCLUDED.p95_latency,
          p99_latency = EXCLUDED.p99_latency
      `,
        [startTime.toISOString(), endTime.toISOString()]
      );
      await client.query('COMMIT');
      console.log(`Computed hourly aggregates from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  private serializeMetadata(metadata?: TelemetryEvent['metadata']): string | null {
    if (metadata === undefined) return null;

    try {
      return JSON.stringify(metadata);
    } catch (error) {
      console.error('Failed to serialize metadata payload', error);
      throw new Error('Invalid metadata: unable to serialize payload to JSON');
    }
  }
}

export const storageService = new StorageService();
