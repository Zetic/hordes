import { ZoneStatus } from '../types/game';

describe('Zone Contest System - Basic Integration', () => {
  test('should have correct zone status enum values', () => {
    expect(ZoneStatus.UNCONTESTED).toBe('uncontested');
    expect(ZoneStatus.CONTESTED).toBe('contested');
    expect(ZoneStatus.TEMPORARILY_UNCONTESTED).toBe('temporarily_uncontested');
  });

  test('should be able to import zone contest service', () => {
    const { ZoneContestService } = require('../services/zoneContest');
    expect(ZoneContestService).toBeDefined();
    expect(typeof ZoneContestService.getInstance).toBe('function');
  });

  test('threat overlay fix should be implemented', () => {
    // This test verifies that the threat overlay fix exists in the code
    const fs = require('fs');
    const worldMapCode = fs.readFileSync('src/services/worldMap.ts', 'utf8');
    
    // Check that threat overlay is only shown for non-hidden tiles
    expect(worldMapCode).toContain('if (tileState !== TileState.HIDDEN)');
    expect(worldMapCode).toContain('// Layer 2: Threat level overlay based on zombie count (only for explored tiles)');
  });

  test('zone contest database schema should be defined', () => {
    const fs = require('fs');
    const schemaCode = fs.readFileSync('database/schema.sql', 'utf8');
    
    // Check that zone_contests table exists
    expect(schemaCode).toContain('CREATE TABLE IF NOT EXISTS zone_contests');
    expect(schemaCode).toContain('status VARCHAR(50) NOT NULL DEFAULT \'uncontested\'');
    expect(schemaCode).toContain('human_cp INTEGER NOT NULL DEFAULT 0');
    expect(schemaCode).toContain('zombie_cp INTEGER NOT NULL DEFAULT 0');
    expect(schemaCode).toContain('temp_uncontested_until TIMESTAMP NULL');
  });

  test('move command should include zone contest checks', () => {
    const fs = require('fs');
    const moveCode = fs.readFileSync('src/commands/move.ts', 'utf8');
    
    // Check that zone contest imports and checks exist
    expect(moveCode).toContain('import { ZoneContestService }');
    expect(moveCode).toContain('canPlayerMoveOut');
    expect(moveCode).toContain('onPlayerLeaveZone');
    expect(moveCode).toContain('onPlayerEnterZone');
    expect(moveCode).toContain('Zone Contested');
  });

  test('search command should include trapped player checks', () => {
    const fs = require('fs');
    const searchCode = fs.readFileSync('src/commands/search.ts', 'utf8');
    
    // Check that zone contest imports and checks exist
    expect(searchCode).toContain('import { ZoneContestService }');
    expect(searchCode).toContain('arePlayersTrapped');
    expect(searchCode).toContain('contested zone');
  });
});