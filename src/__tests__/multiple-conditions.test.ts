import { PlayerStatus, isVitalStatus, isTemporaryCondition, PlayerCondition } from '../types/game';

describe('Multiple Conditions System', () => {
  describe('Status Categorization', () => {
    test('should correctly identify vital statuses', () => {
      expect(isVitalStatus(PlayerCondition.HEALTHY)).toBe(true);
      expect(isVitalStatus(PlayerCondition.WOUNDED)).toBe(true);
      expect(isVitalStatus(PlayerCondition.FED)).toBe(false); // Not a vital condition
    });

    test('should correctly identify temporary conditions', () => {
      expect(isTemporaryCondition(PlayerCondition.REFRESHED)).toBe(true);
      expect(isTemporaryCondition(PlayerCondition.FED)).toBe(true);
      expect(isTemporaryCondition(PlayerCondition.THIRSTY)).toBe(true);
      expect(isTemporaryCondition(PlayerCondition.DEHYDRATED)).toBe(true);
      expect(isTemporaryCondition(PlayerCondition.EXHAUSTED)).toBe(true);
    });

    test('should not cross-categorize statuses', () => {
      // Vital statuses should not be identified as temporary conditions
      expect(isTemporaryCondition(PlayerCondition.HEALTHY)).toBe(false);
      expect(isTemporaryCondition(PlayerCondition.WOUNDED)).toBe(false);
      // Note: PlayerStatus.DEAD is not a PlayerCondition, so this test is not applicable

      // Temporary conditions should not be identified as vital statuses
      expect(isVitalStatus(PlayerCondition.REFRESHED)).toBe(false);
      expect(isVitalStatus(PlayerCondition.FED)).toBe(false);
      expect(isVitalStatus(PlayerCondition.THIRSTY)).toBe(false);
      expect(isVitalStatus(PlayerCondition.DEHYDRATED)).toBe(false);
      expect(isVitalStatus(PlayerCondition.EXHAUSTED)).toBe(false);
    });
  });

  describe('Multiple Conditions Support', () => {
    test('should support player having multiple temporary conditions', () => {
      // Mock player with multiple conditions
      const playerWithMultipleConditions = {
        id: 'test-1',
        discordId: 'user1',
        name: 'Alice',
        health: 100,
        maxHealth: 100,
        status: PlayerCondition.HEALTHY, // Vital status
        conditions: [PlayerCondition.REFRESHED, PlayerCondition.FED], // Multiple conditions
        actionPoints: 10,
        maxActionPoints: 10,
        water: 5,
        isAlive: true,
        location: 'city' as any,
        x: null,
        y: null,
        inventory: [],
        lastActionTime: new Date()
      };

      // Should have healthy vital status
      expect(playerWithMultipleConditions.status).toBe(PlayerCondition.HEALTHY);
      expect(isVitalStatus(playerWithMultipleConditions.status)).toBe(true);

      // Should have both refreshed and fed conditions
      expect(playerWithMultipleConditions.conditions).toContain(PlayerCondition.REFRESHED);
      expect(playerWithMultipleConditions.conditions).toContain(PlayerCondition.FED);
      expect(playerWithMultipleConditions.conditions.length).toBe(2);

      // All conditions should be temporary conditions
      playerWithMultipleConditions.conditions.forEach(condition => {
        expect(isTemporaryCondition(condition)).toBe(true);
      });
    });

    test('should support wounded player with temporary conditions', () => {
      // Mock wounded player with conditions
      const woundedPlayerWithConditions = {
        id: 'test-2',
        discordId: 'user2', 
        name: 'Bob',
        health: 50,
        maxHealth: 100,
        status: PlayerCondition.WOUNDED, // Vital status
        conditions: [PlayerCondition.THIRSTY, PlayerCondition.EXHAUSTED], // Multiple conditions
        actionPoints: 3,
        maxActionPoints: 10,
        water: 1,
        isAlive: true,
        location: 'waste' as any,
        x: 5,
        y: 5,
        inventory: [],
        lastActionTime: new Date()
      };

      // Should have wounded vital status
      expect(woundedPlayerWithConditions.status).toBe(PlayerCondition.WOUNDED);
      expect(isVitalStatus(woundedPlayerWithConditions.status)).toBe(true);

      // Should have multiple conditions
      expect(woundedPlayerWithConditions.conditions).toContain(PlayerCondition.THIRSTY);
      expect(woundedPlayerWithConditions.conditions).toContain(PlayerCondition.EXHAUSTED);
      expect(woundedPlayerWithConditions.conditions.length).toBe(2);
    });

    test('should support player with vital status and no conditions', () => {
      // Mock healthy player with no conditions
      const healthyPlayerNoConditions = {
        id: 'test-3',
        discordId: 'user3',
        name: 'Charlie',
        health: 100,
        maxHealth: 100,
        status: PlayerCondition.HEALTHY,
        conditions: [], // No conditions
        actionPoints: 10,
        maxActionPoints: 10,
        water: 5,
        isAlive: true,
        location: 'city' as any,
        x: null,
        y: null,
        inventory: [],
        lastActionTime: new Date()
      };

      expect(healthyPlayerNoConditions.status).toBe(PlayerCondition.HEALTHY);
      expect(healthyPlayerNoConditions.conditions.length).toBe(0);
    });
  });

  describe('Database Schema Compatibility', () => {
    test('should handle empty conditions with all boolean columns false', () => {
      // Test that empty conditions work correctly with boolean columns
      const mockDatabaseRow = {
        condition_healthy: false,
        condition_wounded: false,
        condition_fed: false,
        condition_refreshed: false,
        condition_thirsty: false,
        condition_dehydrated: false,
        condition_exhausted: false
      };
      
      // Simulate the boolean-to-array conversion logic
      const conditions: PlayerCondition[] = [];
      if (mockDatabaseRow.condition_healthy) conditions.push(PlayerCondition.HEALTHY);
      if (mockDatabaseRow.condition_wounded) conditions.push(PlayerCondition.WOUNDED);
      if (mockDatabaseRow.condition_fed) conditions.push(PlayerCondition.FED);
      if (mockDatabaseRow.condition_refreshed) conditions.push(PlayerCondition.REFRESHED);
      if (mockDatabaseRow.condition_thirsty) conditions.push(PlayerCondition.THIRSTY);
      if (mockDatabaseRow.condition_dehydrated) conditions.push(PlayerCondition.DEHYDRATED);
      if (mockDatabaseRow.condition_exhausted) conditions.push(PlayerCondition.EXHAUSTED);
      
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBe(0);
    });

    test('should handle multiple conditions with boolean columns', () => {
      // Test that multiple conditions work correctly with boolean columns
      const mockDatabaseRow = {
        condition_healthy: false,
        condition_wounded: false,
        condition_fed: true,
        condition_refreshed: true,
        condition_thirsty: false,
        condition_dehydrated: false,
        condition_exhausted: false
      };
      
      // Simulate the boolean-to-array conversion logic
      const conditions: PlayerCondition[] = [];
      if (mockDatabaseRow.condition_healthy) conditions.push(PlayerCondition.HEALTHY);
      if (mockDatabaseRow.condition_wounded) conditions.push(PlayerCondition.WOUNDED);
      if (mockDatabaseRow.condition_fed) conditions.push(PlayerCondition.FED);
      if (mockDatabaseRow.condition_refreshed) conditions.push(PlayerCondition.REFRESHED);
      if (mockDatabaseRow.condition_thirsty) conditions.push(PlayerCondition.THIRSTY);
      if (mockDatabaseRow.condition_dehydrated) conditions.push(PlayerCondition.DEHYDRATED);
      if (mockDatabaseRow.condition_exhausted) conditions.push(PlayerCondition.EXHAUSTED);
      
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBe(2);
      expect(conditions).toContain(PlayerCondition.REFRESHED);
      expect(conditions).toContain(PlayerCondition.FED);
    });
  });
});