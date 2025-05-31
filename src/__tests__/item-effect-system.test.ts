import { ItemEffectService } from '../services/itemEffectService';
import { EffectType, ItemEffect, ItemUseContext, ItemUseResult } from '../types/itemEffects';

// Mock ZombieService
const mockZombieService = {
  getZombiesAtLocation: jest.fn(),
  removeZombiesAtLocation: jest.fn(),
};

jest.mock('../services/zombieService', () => ({
  ZombieService: {
    getInstance: () => mockZombieService
  }
}));

describe('ItemEffectService', () => {
  let effectService: ItemEffectService;

  beforeEach(() => {
    jest.clearAllMocks();
    effectService = ItemEffectService.getInstance();
  });

  describe('Singleton pattern', () => {
    test('should return the same instance', () => {
      const instance1 = ItemEffectService.getInstance();
      const instance2 = ItemEffectService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Effect registration', () => {
    test('should register default handlers', () => {
      expect(effectService.hasHandler(EffectType.KILL_ZOMBIE)).toBe(true);
      expect(effectService.hasHandler(EffectType.HEAL_PLAYER)).toBe(true);
    });

    test('should allow registering custom handlers', () => {
      const customHandler = jest.fn().mockResolvedValue({ success: true, message: 'Custom effect' });
      effectService.registerHandler(EffectType.PROVIDE_RESOURCE, customHandler);
      
      expect(effectService.hasHandler(EffectType.PROVIDE_RESOURCE)).toBe(true);
    });
  });

  describe('Effect execution', () => {
    test('should execute kill zombie effect successfully', async () => {
      // Setup mocks
      mockZombieService.getZombiesAtLocation.mockResolvedValue({ count: 5 });
      mockZombieService.removeZombiesAtLocation.mockResolvedValue(true);

      const effect: ItemEffect = {
        type: EffectType.KILL_ZOMBIE,
        chance: 100, // Guaranteed success for testing
        value: 1,
        breakChance: 0 // No break for testing
      };

      const context: ItemUseContext = {
        player: { id: 'test-player', health: 100, maxHealth: 100 },
        location: { x: 5, y: 5 }
      };

      const result = await effectService.executeEffect(effect, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully killed 1 zombie');
      expect(mockZombieService.removeZombiesAtLocation).toHaveBeenCalledWith(5, 5, 1);
    });

    test('should handle missing effect handler', async () => {
      const effect: ItemEffect = {
        type: 'INVALID_EFFECT' as EffectType
      };

      const context: ItemUseContext = {
        player: { id: 'test-player' },
        location: { x: 5, y: 5 }
      };

      await expect(effectService.executeEffect(effect, context))
        .rejects.toThrow('No handler registered for effect type: INVALID_EFFECT');
    });

    test('should handle heal player effect', async () => {
      const effect: ItemEffect = {
        type: EffectType.HEAL_PLAYER,
        value: 25
      };

      const context: ItemUseContext = {
        player: { id: 'test-player', health: 50, maxHealth: 100 },
        location: { x: 5, y: 5 }
      };

      const result = await effectService.executeEffect(effect, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Healed 25 health points');
      expect(result.effectData.newHealth).toBe(75);
    });
  });

  describe('Combat effect scenarios', () => {
    test('should handle attack when no zombies present', async () => {
      mockZombieService.getZombiesAtLocation.mockResolvedValue({ count: 0 });

      const effect: ItemEffect = {
        type: EffectType.KILL_ZOMBIE,
        chance: 60,
        value: 1
      };

      const context: ItemUseContext = {
        player: { id: 'test-player' },
        location: { x: 5, y: 5 }
      };

      const result = await effectService.executeEffect(effect, context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('There are no zombies here to attack');
    });

    test('should handle item breaking with transformation', async () => {
      mockZombieService.getZombiesAtLocation.mockResolvedValue({ count: 3 });
      mockZombieService.removeZombiesAtLocation.mockResolvedValue(true);

      // Mock Math.random to control the outcome
      const originalRandom = Math.random;
      Math.random = jest.fn()
        .mockReturnValueOnce(0.5) // 50% for kill roll (success with 60% chance)
        .mockReturnValueOnce(0.5); // 50% for break roll (success with 70% chance)

      const effect: ItemEffect = {
        type: EffectType.KILL_ZOMBIE,
        chance: 60,
        value: 1,
        breakChance: 70,
        transformInto: 'Broken Box Cutter'
      };

      const context: ItemUseContext = {
        player: { id: 'test-player' },
        location: { x: 5, y: 5 }
      };

      const result = await effectService.executeEffect(effect, context);

      expect(result.success).toBe(true);
      expect(result.itemBroken).toBe(true);
      expect(result.transformedInto).toBe('Broken Box Cutter');
      expect(result.message).toContain('Successfully killed 1 zombie');
      expect(result.message).toContain('transformed into Broken Box Cutter');

      // Restore Math.random
      Math.random = originalRandom;
    });
  });
});