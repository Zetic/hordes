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

      // Initialize database schema
      await this.initializeSchema();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }

  private async initializeSchema(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS players (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          discord_id VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          health INTEGER DEFAULT 100,
          max_health INTEGER DEFAULT 100,
          status VARCHAR(50) DEFAULT 'healthy',
          action_points INTEGER DEFAULT 10,
          max_action_points INTEGER DEFAULT 10,
          water INTEGER DEFAULT 3,
          is_alive BOOLEAN DEFAULT true,
          location VARCHAR(50) DEFAULT 'city',
          last_action_time TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Add status column to existing tables if it doesn't exist
      await this.pool.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'healthy';
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          defense_level INTEGER DEFAULT 0,
          population INTEGER DEFAULT 0,
          day INTEGER DEFAULT 1,
          game_phase VARCHAR(50) DEFAULT 'play_mode',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          description TEXT,
          weight INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          player_id UUID REFERENCES players(id) ON DELETE CASCADE,
          item_id UUID REFERENCES items(id),
          quantity INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS buildings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          level INTEGER DEFAULT 1,
          health INTEGER DEFAULT 100,
          max_health INTEGER DEFAULT 100,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS bank_inventories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
          item_id UUID REFERENCES items(id),
          quantity INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS area_inventories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          location VARCHAR(50) NOT NULL,
          item_id UUID REFERENCES items(id),
          quantity INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error);
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    await this.redis.quit();
    console.log('🔌 Database connections closed');
  }
}