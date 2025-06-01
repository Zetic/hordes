import { PlayerService } from '../models/player';
import { PlayerStatus } from '../types/game';

describe('Boolean Conditions Column Edge Cases', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService();
  });

  test('should handle null/undefined boolean values gracefully', () => {
    // Test edge cases with database boolean values
    const mockRow = {
      id: 'test-1',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // Test with null/undefined boolean values (edge case)
      condition_healthy: null,
      condition_wounded: undefined,
      condition_fed: false,
      condition_refreshed: true,
      condition_thirsty: false,
      condition_dehydrated: false,
      condition_exhausted: false
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    
    expect(() => {
      const player = mapRowToPlayer(mockRow);
      // Should handle falsy values gracefully
      expect(Array.isArray(player.conditions)).toBe(true);
      // Only condition_refreshed should be true
      expect(player.conditions.length).toBe(1);
      expect(player.conditions[0]).toBe('refreshed');
    }).not.toThrow();
  });

  test('should handle boolean column type coercion', () => {
    // Test that non-boolean values are handled correctly
    const mockRow = {
      id: 'test-2',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // Test with non-boolean values that might come from database
      condition_healthy: 1, // Truthy number
      condition_wounded: 0, // Falsy number
      condition_fed: 'true', // String
      condition_refreshed: '', // Empty string (falsy)
      condition_thirsty: 'false', // String 'false' (truthy!)
      condition_dehydrated: false,
      condition_exhausted: true
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    expect(Array.isArray(player.conditions)).toBe(true);
    // Should handle truthy/falsy conversion
    const hasHealthy = player.conditions.includes('healthy');
    const hasWounded = player.conditions.includes('wounded');
    const hasFed = player.conditions.includes('fed');
    const hasRefreshed = player.conditions.includes('refreshed');
    const hasThirsty = player.conditions.includes('thirsty');
    const hasExhausted = player.conditions.includes('exhausted');
    
    expect(hasHealthy).toBe(true); // 1 is truthy
    expect(hasWounded).toBe(false); // 0 is falsy
    expect(hasFed).toBe(true); // 'true' is truthy
    expect(hasRefreshed).toBe(false); // '' is falsy
    expect(hasThirsty).toBe(true); // 'false' string is truthy!
    expect(hasExhausted).toBe(true); // true boolean
  });

  test('should handle missing boolean columns gracefully', () => {
    // Test when some condition columns are missing from database row
    const mockRow = {
      id: 'test-3',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // Only some condition columns present
      condition_healthy: true,
      condition_wounded: false,
      // condition_fed missing
      // condition_refreshed missing
      condition_thirsty: false,
      condition_dehydrated: false,
      condition_exhausted: false
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    
    expect(() => {
      const player = mapRowToPlayer(mockRow);
      expect(Array.isArray(player.conditions)).toBe(true);
      // Should only include conditions that are explicitly true
      expect(player.conditions.length).toBe(1);
      expect(player.conditions[0]).toBe('healthy');
    }).not.toThrow();
  });

  test('should work with all boolean columns false', () => {
    const mockRow = {
      id: 'test-4',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
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

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(0);
  });

  test('should work with all boolean columns true', () => {
    const mockRow = {
      id: 'test-5',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date(),
      // All conditions true
      condition_healthy: true,
      condition_wounded: true,
      condition_fed: true,
      condition_refreshed: true,
      condition_thirsty: true,
      condition_dehydrated: true,
      condition_exhausted: true
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(7); // All 7 conditions
    expect(player.conditions).toContain('healthy');
    expect(player.conditions).toContain('wounded');
    expect(player.conditions).toContain('fed');
    expect(player.conditions).toContain('refreshed');
    expect(player.conditions).toContain('thirsty');
    expect(player.conditions).toContain('dehydrated');
    expect(player.conditions).toContain('exhausted');
  });
});