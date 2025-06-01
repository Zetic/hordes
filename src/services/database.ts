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
          x INTEGER DEFAULT NULL,
          y INTEGER DEFAULT NULL,
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

      // Add coordinate columns to existing tables if they don't exist
      await this.pool.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS x INTEGER DEFAULT NULL;
      `);

      await this.pool.query(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS y INTEGER DEFAULT NULL;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          defense_level INTEGER DEFAULT 0,
          population INTEGER DEFAULT 0,
          day INTEGER DEFAULT 1,
          game_phase VARCHAR(50) DEFAULT 'play_mode',
          gate_open BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Add gate_open column to existing cities table if it doesn't exist
      await this.pool.query(`
        ALTER TABLE cities 
        ADD COLUMN IF NOT EXISTS gate_open BOOLEAN DEFAULT true;
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

      // Add missing columns to items table if they don't exist
      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS category VARCHAR(255);
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS sub_category VARCHAR(255);
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS kill_chance INTEGER;
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS break_chance INTEGER;
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS kill_count INTEGER;
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS on_break VARCHAR(255);
      `);

      await this.pool.query(`
        ALTER TABLE items 
        ADD COLUMN IF NOT EXISTS broken BOOLEAN DEFAULT false;
      `);

      // Verify that all required item columns exist
      await this.verifyItemsTableSchema();

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

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS zombies (
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (x, y)
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS explored_tiles (
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (x, y)
        );
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS zone_contests (
          x INTEGER NOT NULL,
          y INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'uncontested',
          human_cp INTEGER NOT NULL DEFAULT 0,
          zombie_cp INTEGER NOT NULL DEFAULT 0,
          temp_uncontested_until TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (x, y)
        );
      `);

      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('❌ Failed to initialize schema:', error);
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

  public async wipeAllData(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete all data from tables in the correct order to respect foreign key constraints
      // This order is derived from the schema defined in initializeSchema() method above
      // and ensures no foreign key violations occur during deletion
      
      // First delete from tables that reference other tables
      await client.query('DELETE FROM area_inventories');
      await client.query('DELETE FROM explored_tiles');
      await client.query('DELETE FROM zombies');
      await client.query('DELETE FROM zone_contests');
      await client.query('DELETE FROM inventory');
      await client.query('DELETE FROM bank_inventories');
      await client.query('DELETE FROM buildings');
      
      // Then delete from main data tables
      await client.query('DELETE FROM players');
      await client.query('DELETE FROM items');
      await client.query('DELETE FROM cities');
      
      // Re-create the default city to ensure system remains functional
      await client.query(`
        INSERT INTO cities (name, day, game_phase, gate_open)
        VALUES ('Sanctuary', 1, 'play_mode', true)
      `);
      
      await client.query('COMMIT');
      console.log('✅ Database completely wiped and reset to initial state');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to wipe database:', error);
      return false;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    await this.redis.quit();
    console.log('🔌 Database connections closed');
  }
}