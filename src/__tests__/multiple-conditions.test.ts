import { PlayerStatus, isVitalStatus, isTemporaryCondition } from '../types/game';

describe('Multiple Conditions System', () => {
  describe('Status Categorization', () => {
    test('should correctly identify vital statuses', () => {
      expect(isVitalStatus(PlayerStatus.HEALTHY)).toBe(true);
      expect(isVitalStatus(PlayerStatus.WOUNDED)).toBe(true);
      expect(isVitalStatus(PlayerStatus.DEAD)).toBe(true);
    });

    test('should correctly identify temporary conditions', () => {
      expect(isTemporaryCondition(PlayerStatus.REFRESHED)).toBe(true);
      expect(isTemporaryCondition(PlayerStatus.FED)).toBe(true);
      expect(isTemporaryCondition(PlayerStatus.THIRSTY)).toBe(true);
      expect(isTemporaryCondition(PlayerStatus.DEHYDRATED)).toBe(true);
      expect(isTemporaryCondition(PlayerStatus.EXHAUSTED)).toBe(true);
    });

    test('should not cross-categorize statuses', () => {
      // Vital statuses should not be identified as temporary conditions
      expect(isTemporaryCondition(PlayerStatus.HEALTHY)).toBe(false);
      expect(isTemporaryCondition(PlayerStatus.WOUNDED)).toBe(false);
      expect(isTemporaryCondition(PlayerStatus.DEAD)).toBe(false);

      // Temporary conditions should not be identified as vital statuses
      expect(isVitalStatus(PlayerStatus.REFRESHED)).toBe(false);
      expect(isVitalStatus(PlayerStatus.FED)).toBe(false);
      expect(isVitalStatus(PlayerStatus.THIRSTY)).toBe(false);
      expect(isVitalStatus(PlayerStatus.DEHYDRATED)).toBe(false);
      expect(isVitalStatus(PlayerStatus.EXHAUSTED)).toBe(false);
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
        status: PlayerStatus.HEALTHY, // Vital status
        conditions: [PlayerStatus.REFRESHED, PlayerStatus.FED], // Multiple conditions
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
      expect(playerWithMultipleConditions.status).toBe(PlayerStatus.HEALTHY);
      expect(isVitalStatus(playerWithMultipleConditions.status)).toBe(true);

      // Should have both refreshed and fed conditions
      expect(playerWithMultipleConditions.conditions).toContain(PlayerStatus.REFRESHED);
      expect(playerWithMultipleConditions.conditions).toContain(PlayerStatus.FED);
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
        status: PlayerStatus.WOUNDED, // Vital status
        conditions: [PlayerStatus.THIRSTY, PlayerStatus.EXHAUSTED], // Multiple conditions
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
      expect(woundedPlayerWithConditions.status).toBe(PlayerStatus.WOUNDED);
      expect(isVitalStatus(woundedPlayerWithConditions.status)).toBe(true);

      // Should have multiple conditions
      expect(woundedPlayerWithConditions.conditions).toContain(PlayerStatus.THIRSTY);
      expect(woundedPlayerWithConditions.conditions).toContain(PlayerStatus.EXHAUSTED);
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
        status: PlayerStatus.HEALTHY,
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

      expect(healthyPlayerNoConditions.status).toBe(PlayerStatus.HEALTHY);
      expect(healthyPlayerNoConditions.conditions.length).toBe(0);
    });
  });

  describe('Database Schema Compatibility', () => {
    test('should handle empty conditions array in JSON format', () => {
      const emptyConditionsJson = '[]';
      const parsedConditions = JSON.parse(emptyConditionsJson);
      
      expect(Array.isArray(parsedConditions)).toBe(true);
      expect(parsedConditions.length).toBe(0);
    });

    test('should handle multiple conditions in JSON format', () => {
      const multipleConditionsJson = `["${PlayerStatus.REFRESHED}", "${PlayerStatus.FED}"]`;
      const parsedConditions = JSON.parse(multipleConditionsJson);
      
      expect(Array.isArray(parsedConditions)).toBe(true);
      expect(parsedConditions.length).toBe(2);
      expect(parsedConditions).toContain(PlayerStatus.REFRESHED);
      expect(parsedConditions).toContain(PlayerStatus.FED);
    });
  });
});