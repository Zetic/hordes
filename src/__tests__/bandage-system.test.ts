import { handleRemoveStatusEffect, handleAddStatusEffect } from '../services/effects/statusEffects';
import { PlayerStatus } from '../types/game';
import { EffectType, ItemUseContext, ItemEffect } from '../types/itemEffects';

describe('Bandage System', () => {
  const mockPlayer = {
    discordId: 'test123',
    status: PlayerStatus.WOUNDED_ARM,
    conditions: [],
    health: 80,
    maxHealth: 100
  };

  const mockContext: ItemUseContext = {
    player: mockPlayer,
    location: { x: 5, y: 5 }
  };

  test('should heal wound and add healed condition', async () => {
    // Test removing wound
    const removeWoundEffect: ItemEffect = {
      type: EffectType.REMOVE_STATUS,
      status: 'wounded_arm'
    };

    const woundResult = await handleRemoveStatusEffect(removeWoundEffect, mockContext);
    expect(woundResult.success).toBe(true);
    expect(woundResult.message).toBe('🩹 Wound treated successfully.');

    // Test adding healed condition
    const addHealedEffect: ItemEffect = {
      type: EffectType.ADD_STATUS,
      status: 'healed'
    };

    const healedResult = await handleAddStatusEffect(addHealedEffect, mockContext);
    expect(healedResult.success).toBe(true);
    expect(healedResult.message).toBe('🩹 You feel healed and restored!');
  });

  test('should prevent bandage use when already healed', async () => {
    const mockHealedPlayer = {
      ...mockPlayer,
      conditions: [PlayerStatus.HEALED]
    };

    const healedContext: ItemUseContext = {
      player: mockHealedPlayer,
      location: { x: 5, y: 5 }
    };

    const addHealedEffect: ItemEffect = {
      type: EffectType.ADD_STATUS,
      status: 'healed'
    };

    const result = await handleAddStatusEffect(addHealedEffect, healedContext);
    expect(result.success).toBe(false);
    expect(result.message).toBe('🩹 You are already healed and cannot use another bandage.');
  });

  test('should prevent bandage use when no wounds present', async () => {
    const mockHealthyPlayer = {
      ...mockPlayer,
      status: PlayerStatus.ALIVE,
      conditions: []
    };

    const healthyContext: ItemUseContext = {
      player: mockHealthyPlayer,
      location: { x: 5, y: 5 }
    };

    const addHealedEffect: ItemEffect = {
      type: EffectType.ADD_STATUS,
      status: 'healed'
    };

    const result = await handleAddStatusEffect(addHealedEffect, healthyContext);
    expect(result.success).toBe(false);
    expect(result.message).toBe('🩹 You have no wounds to heal.');
  });
});