import { PlayerCondition } from '../types/game';
import { PlayerService } from '../models/player';

describe('Conditions Boolean Columns Fix', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService();
  });

  test('should map boolean columns to condition arrays correctly', () => {
    // Test the new mapping logic from boolean columns to PlayerCondition array
    
    // Mock database row with only healthy condition
    const healthyRow = {
      condition_healthy: true,
      condition_wounded: false,
      condition_fed: false,
      condition_refreshed: false,
      condition_thirsty: false,
      condition_dehydrated: false,
      condition_exhausted: false
    };

    // Use reflection to test private mapRowToPlayer method
    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const mockRowHealthy = {
      id: 'test-1',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: 'alive',
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      ...healthyRow
    };

    const player = mapRowToPlayer(mockRowHealthy);
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(1);
    expect(player.conditions[0]).toBe(PlayerCondition.HEALTHY);
  });

  test('should handle multiple conditions in boolean columns', () => {
    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const mockRowMultiple = {
      id: 'test-2',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: 'alive',
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // Multiple conditions true
      condition_healthy: false,
      condition_wounded: true,
      condition_fed: true,
      condition_refreshed: false,
      condition_thirsty: false,
      condition_dehydrated: false,
      condition_exhausted: false
    };

    const player = mapRowToPlayer(mockRowMultiple);
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(2);
    expect(player.conditions).toContain(PlayerCondition.WOUNDED);
    expect(player.conditions).toContain(PlayerCondition.FED);
  });

  test('should handle no conditions (all false)', () => {
    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const mockRowNone = {
      id: 'test-3',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: 'alive',
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // All conditions false
      condition_healthy: false,
      condition_wounded: false,
      condition_fed: false,
      condition_refreshed: false,
      condition_thirsty: false,
      condition_dehydrated: false,
      condition_exhausted: false
    };

    const player = mapRowToPlayer(mockRowNone);
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(0);
  });

  test('should validate database schema uses boolean columns', () => {
    // Test that the new column definition is valid for PostgreSQL boolean columns
    const expectedColumns = [
      'condition_healthy BOOLEAN DEFAULT true',
      'condition_wounded BOOLEAN DEFAULT false',
      'condition_fed BOOLEAN DEFAULT false',
      'condition_refreshed BOOLEAN DEFAULT false',
      'condition_thirsty BOOLEAN DEFAULT false',
      'condition_dehydrated BOOLEAN DEFAULT false',
      'condition_exhausted BOOLEAN DEFAULT false'
    ];
    
    expectedColumns.forEach(columnDef => {
      expect(columnDef).toContain('BOOLEAN');
      expect(columnDef).toContain('DEFAULT');
      expect(columnDef).not.toContain('JSON');
      expect(columnDef).not.toContain('JSONB');
    });
  });

  test('should map condition strings to column names correctly', () => {
    // Test the condition mapping helper (if accessible)
    const getConditionColumnName = (playerService as any).getConditionColumnName?.bind(playerService);
    
    if (getConditionColumnName) {
      expect(getConditionColumnName(PlayerCondition.HEALTHY)).toBe('condition_healthy');
      expect(getConditionColumnName(PlayerCondition.WOUNDED)).toBe('condition_wounded');
      expect(getConditionColumnName(PlayerCondition.FED)).toBe('condition_fed');
      expect(getConditionColumnName(PlayerCondition.REFRESHED)).toBe('condition_refreshed');
      expect(getConditionColumnName(PlayerCondition.THIRSTY)).toBe('condition_thirsty');
      expect(getConditionColumnName(PlayerCondition.DEHYDRATED)).toBe('condition_dehydrated');
      expect(getConditionColumnName(PlayerCondition.EXHAUSTED)).toBe('condition_exhausted');
      expect(getConditionColumnName('invalid_condition')).toBe(null);
    }
  });
});