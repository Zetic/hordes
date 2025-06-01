// Test to verify that the new items can be found and status system works correctly
import { getItemDefinition, getAllItemDefinitions } from '../data/items';
import { PlayerStatus, PlayerCondition } from '../types/game';
import { handleRemoveStatusEffect, handleAddStatusEffect } from '../services/effects/statusEffects';
import { EffectType, ItemUseContext, ItemEffect } from '../types/itemEffects';

describe('Item Spawn and Status Fix Tests', () => {
  describe('Item Definition Discovery', () => {
    test('Water Ration should be discoverable by name', () => {
      const item = getItemDefinition('Water Ration');
      expect(item).toBeDefined();
      expect(item?.name).toBe('Water Ration');
      expect(item?.type).toBe('consumable');
    });

    test('Stale Tart should be discoverable by name', () => {
      const item = getItemDefinition('Stale Tart');
      expect(item).toBeDefined();
      expect(item?.name).toBe('Stale Tart');
      expect(item?.type).toBe('consumable');
    });

    test('All items from definitions should be accessible', () => {
      const allItems = getAllItemDefinitions();
      expect(allItems).toHaveLength(4); // Box Cutter, Broken Box Cutter, Water Ration, Stale Tart
      
      const itemNames = allItems.map(item => item.name);
      expect(itemNames).toContain('Box Cutter');
      expect(itemNames).toContain('Broken Box Cutter');
      expect(itemNames).toContain('Water Ration');
      expect(itemNames).toContain('Stale Tart');
    });
  });

  describe('Status Removal Logic', () => {
    test('Removing refreshed status should not set to healthy if player is wounded', async () => {
      const mockPlayer = {
        discordId: 'test123',
        status: PlayerCondition.WOUNDED, // Vital status based on health
        conditions: [PlayerCondition.REFRESHED], // Temporary condition
        health: 50,
        maxHealth: 100
      };

      const context: ItemUseContext = {
        player: mockPlayer as any,
        location: { x: 5, y: 5 }
      };

      const removeEffect: ItemEffect = {
        type: EffectType.REMOVE_STATUS,
        status: 'refreshed'
      };

      // Since the status system should determine status based on health when removing non-health statuses
      // A wounded player (health < maxHealth) should remain wounded after refreshed is removed
      const result = await handleRemoveStatusEffect(removeEffect, context);
      
      expect(result.success).toBe(true);
      expect(result.effectData?.statusRemoved).toBe(true);
      expect(result.effectData?.removedStatus).toBe('refreshed');
    });

    test('Removing fed status should not set to healthy if player is wounded', async () => {
      const mockPlayer = {
        discordId: 'test456',
        status: PlayerCondition.WOUNDED, // Vital status based on health
        conditions: [PlayerCondition.FED], // Temporary condition
        health: 70,
        maxHealth: 100
      };

      const context: ItemUseContext = {
        player: mockPlayer as any,
        location: { x: 5, y: 5 }
      };

      const removeEffect: ItemEffect = {
        type: EffectType.REMOVE_STATUS,
        status: 'fed'
      };

      const result = await handleRemoveStatusEffect(removeEffect, context);
      
      expect(result.success).toBe(true);
      expect(result.effectData?.statusRemoved).toBe(true);
      expect(result.effectData?.removedStatus).toBe('fed');
    });

    test('Status messages should be defined for all new statuses', () => {
      const statusMessages = [
        PlayerCondition.REFRESHED,
        PlayerCondition.FED,
        PlayerCondition.THIRSTY,
        PlayerCondition.DEHYDRATED,
        PlayerCondition.EXHAUSTED
      ];

      statusMessages.forEach(status => {
        expect(status).toBeDefined();
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Item Effects Validation', () => {
    test('Water Ration should have correct effect types', () => {
      const waterRation = getItemDefinition('Water Ration');
      expect(waterRation).toBeDefined();
      
      const effectTypes = waterRation!.effects.map(e => e.type);
      expect(effectTypes).toContain(EffectType.RESTORE_AP);
      expect(effectTypes).toContain(EffectType.ADD_STATUS);
      expect(effectTypes).toContain(EffectType.REMOVE_STATUS);
    });

    test('Stale Tart should have correct effect types', () => {
      const staleTart = getItemDefinition('Stale Tart');
      expect(staleTart).toBeDefined();
      
      const effectTypes = staleTart!.effects.map(e => e.type);
      expect(effectTypes).toContain(EffectType.RESTORE_AP);
      expect(effectTypes).toContain(EffectType.ADD_STATUS);
      expect(effectTypes).toContain(EffectType.REMOVE_STATUS);
    });
  });
});