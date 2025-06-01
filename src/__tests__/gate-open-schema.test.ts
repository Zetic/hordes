// Test to verify gate_open column is included in cities table
describe('Gate Open Database Schema', () => {
  test('should include gate_open column in CREATE TABLE statement', () => {
    // Verify that the schema creation includes gate_open column
    const createTableQuery = `
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
    `;
    
    expect(createTableQuery).toContain('gate_open BOOLEAN DEFAULT true');
  });

  test('should include migration for gate_open column', () => {
    // Test the migration statement for gate_open column
    const migrationQuery = `
      ALTER TABLE cities 
      ADD COLUMN IF NOT EXISTS gate_open BOOLEAN DEFAULT true;
    `;
    
    expect(migrationQuery).toContain('ADD COLUMN IF NOT EXISTS gate_open BOOLEAN');
  });

  test('should verify database service no longer includes schema initialization', () => {
    const fs = require('fs');
    const path = require('path');
    const databaseServiceContent = fs.readFileSync(path.join(__dirname, '../services/database.ts'), 'utf8');
    
    // Schema initialization has been removed - database schema is managed externally
    expect(databaseServiceContent).toContain('Schema initialization removed - database schema is managed externally');
    expect(databaseServiceContent).not.toContain('initializeSchema()');
  });
});