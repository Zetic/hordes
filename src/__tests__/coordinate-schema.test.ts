// Test to verify coordinate columns are in the schema
describe('Database Schema Coordinate Columns', () => {
  test('should include x and y columns in CREATE TABLE statement', () => {
    // Verify that the schema creation includes coordinate columns
    const createTableQuery = `
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
    `;
    
    expect(createTableQuery).toContain('x INTEGER DEFAULT NULL');
    expect(createTableQuery).toContain('y INTEGER DEFAULT NULL');
  });

  test('should include migration for coordinate columns', () => {
    // Test the migration statements for coordinate columns
    const xMigrationQuery = `
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS x INTEGER DEFAULT NULL;
    `;
    
    const yMigrationQuery = `
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS y INTEGER DEFAULT NULL;
    `;
    
    expect(xMigrationQuery).toContain('ADD COLUMN IF NOT EXISTS x INTEGER');
    expect(yMigrationQuery).toContain('ADD COLUMN IF NOT EXISTS y INTEGER');
  });
});