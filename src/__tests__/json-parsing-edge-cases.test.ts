import { PlayerService } from '../models/player';
import { PlayerStatus } from '../types/game';

describe('JSON Parsing Edge Cases Fix', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService();
  });

  test('should handle plain string conditions gracefully', () => {
    // Simulate a database row with invalid JSON conditions (plain string)
    const mockRow = {
      id: 'test-1',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: 'refreshed', // Invalid: plain string instead of JSON array
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    // Use reflection to access private method for testing
    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    
    // Should not throw and should default to empty conditions array
    expect(() => {
      const player = mapRowToPlayer(mockRow);
      expect(Array.isArray(player.conditions)).toBe(true);
      expect(player.conditions.length).toBe(0);
    }).not.toThrow();
  });

  test('should handle quoted string conditions by converting to array', () => {
    // Simulate a database row with JSON string condition
    const mockRow = {
      id: 'test-2',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: '"refreshed"', // Valid JSON string but not array
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    // Should convert single value to array
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(1);
    expect(player.conditions[0]).toBe('refreshed');
  });

  test('should handle empty string conditions', () => {
    const mockRow = {
      id: 'test-3',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: '', // Empty string
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    // Empty string should result in empty array
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(0);
  });

  test('should handle null conditions', () => {
    const mockRow = {
      id: 'test-4',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: null, // Null value
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    // Null should result in empty array
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(0);
  });

  test('should handle valid JSON array conditions', () => {
    const mockRow = {
      id: 'test-5',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: '["refreshed", "fed"]', // Valid JSON array
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    const player = mapRowToPlayer(mockRow);
    
    // Should parse correctly
    expect(Array.isArray(player.conditions)).toBe(true);
    expect(player.conditions.length).toBe(2);
    expect(player.conditions).toContain('refreshed');
    expect(player.conditions).toContain('fed');
  });

  test('should handle non-string database values (critical fix)', () => {
    // This test specifically addresses the bug where database returns non-string types
    // causing "TypeError: jsonString.trim is not a function"
    
    // Test with number value from database
    const mockRowWithNumber = {
      id: 'test-6',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: 123, // Database returned a number instead of string
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    
    // Should not throw and should default to empty conditions array
    expect(() => {
      const player = mapRowToPlayer(mockRowWithNumber);
      expect(Array.isArray(player.conditions)).toBe(true);
      expect(player.conditions.length).toBe(0);
    }).not.toThrow();

    // Test with boolean value from database
    const mockRowWithBoolean = {
      ...mockRowWithNumber,
      id: 'test-7',
      conditions: true // Database returned a boolean instead of string
    };

    expect(() => {
      const player = mapRowToPlayer(mockRowWithBoolean);
      expect(Array.isArray(player.conditions)).toBe(true);
      expect(player.conditions.length).toBe(0);
    }).not.toThrow();

    // Test with object value from database
    const mockRowWithObject = {
      ...mockRowWithNumber,
      id: 'test-8',
      conditions: { some: 'object' } // Database returned an object instead of string
    };

    expect(() => {
      const player = mapRowToPlayer(mockRowWithObject);
      expect(Array.isArray(player.conditions)).toBe(true);
      expect(player.conditions.length).toBe(0);
    }).not.toThrow();
  });

  test('should handle JSONB array conditions (already parsed) - critical fix', () => {
    // This test addresses the core issue: JSONB returns already-parsed arrays, not strings
    const mockRow = {
      id: 'test-9',
      discord_id: '123456789',
      name: 'TestPlayer',
      health: 100,
      max_health: 100,
      status: PlayerStatus.ALIVE,
      conditions: ['refreshed', 'fed'], // JSONB case - already a JavaScript array
      action_points: 10,
      max_action_points: 10,
      water: 5,
      is_alive: true,
      location: 'city',
      x: null,
      y: null,
      last_action_time: new Date()
    };

    const mapRowToPlayer = (playerService as any).mapRowToPlayer.bind(playerService);
    
    // Should handle array input without trying to JSON.parse it
    expect(() => {
      const player = mapRowToPlayer(mockRow);
      expect(Array.isArray(player.conditions)).toBe(true);
      expect(player.conditions.length).toBe(2);
      expect(player.conditions).toContain('refreshed');
      expect(player.conditions).toContain('fed');
    }).not.toThrow();
  });
});