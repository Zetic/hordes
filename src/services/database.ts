import { Pool } from 'pg';
import { createClient } from 'redis';

export class DatabaseService {
  private static instance: DatabaseService;
  public pool: Pool;
  public redis: any;

  private constructor() {
    // PostgreSQL connection
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Redis connection
    this.redis = createClient({
      url: process.env.REDIS_URL
    });

    this.initialize();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private async initialize(): Promise<void> {
    try {
      // Test PostgreSQL connection
      await this.pool.query('SELECT NOW()');
      console.log('✅ Connected to PostgreSQL');

      // Connect to Redis
      await this.redis.connect();
      console.log('✅ Connected to Redis');

      // Schema initialization removed - database schema is managed externally
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }

  // Verify that all required columns exist in the items table
  private async verifyItemsTableSchema(): Promise<void> {
    try {
      const requiredColumns = [
        'id', 'name', 'type', 'description', 'weight', 'created_at',
        'category', 'sub_category', 'kill_chance', 'break_chance', 
        'kill_count', 'on_break', 'broken'
      ];

      // Query to get all column names from the items table
      const result = await this.pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' 
        AND table_schema = 'public'
      `);

      const existingColumns = result.rows.map(row => row.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns in items table: ${missingColumns.join(', ')}`);
      }

      console.log('✅ Items table schema verification passed');
    } catch (error) {
      console.error('❌ Items table schema verification failed:', error);
      throw error;
    }
  }

  // Public method to check if the items table schema is properly configured
  public async isItemsSchemaValid(): Promise<boolean> {
    try {
      await this.verifyItemsTableSchema();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    await this.redis.quit();
    console.log('🔌 Database connections closed');
  }
}