import { ItemEffectService } from '../services/itemEffectService';
import { getItemDefinition } from '../data/items';
import { EffectType } from '../types/itemEffects';

// Simple mock setup for ZombieService
jest.mock('../services/zombieService', () => ({
  ZombieService: {
    getInstance: () => ({
      getZombiesAtLocation: jest.fn(),
      removeZombiesAtLocation: jest.fn()
    })
  }
}));

describe('Use Command Integration with Item Effect System', () => {
  test('should validate item definition system integration', () => {
    const effectService = ItemEffectService.getInstance();
    
    // Verify effect service has required handlers
    expect(effectService.hasHandler(EffectType.KILL_ZOMBIE)).toBe(true);
    expect(effectService.hasHandler(EffectType.HEAL_PLAYER)).toBe(true);

    // Verify item definitions are available
    const boxCutterDef = getItemDefinition('Box Cutter');
    expect(boxCutterDef).toBeDefined();
    expect(boxCutterDef!.effects).toHaveLength(1);
    expect(boxCutterDef!.effects[0].type).toBe(EffectType.KILL_ZOMBIE);
    expect(boxCutterDef!.effects[0].chance).toBe(60);
    expect(boxCutterDef!.effects[0].breakChance).toBe(70);

    const brokenBoxCutterDef = getItemDefinition('Broken Box Cutter');
    expect(brokenBoxCutterDef).toBeDefined();
    expect(brokenBoxCutterDef!.effects).toHaveLength(0);
  });

  test('should register and execute effects correctly', async () => {
    const effectService = ItemEffectService.getInstance();
    
    // Test registering a custom handler
    const customHandler = jest.fn().mockResolvedValue({
      success: true,
      message: 'Custom effect executed'
    });
    
    effectService.registerHandler(EffectType.PROVIDE_RESOURCE, customHandler);
    expect(effectService.hasHandler(EffectType.PROVIDE_RESOURCE)).toBe(true);
    
    // Test executing the custom effect
    const effect = {
      type: EffectType.PROVIDE_RESOURCE,
      value: 10
    };
    
    const context = {
      player: { id: 'test-player' },
      location: { x: 5, y: 5 }
    };
    
    const result = await effectService.executeEffect(effect, context);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Custom effect executed');
    expect(customHandler).toHaveBeenCalledWith(effect, context);
  });

  test('should handle error cases in effect execution', async () => {
    const effectService = ItemEffectService.getInstance();
    
    // Try to execute an unregistered effect
    const effect = {
      type: 'UNREGISTERED_EFFECT' as EffectType
    };
    
    const context = {
      player: { id: 'test-player' },
      location: { x: 5, y: 5 }
    };
    
    await expect(effectService.executeEffect(effect, context))
      .rejects.toThrow('No handler registered for effect type: UNREGISTERED_EFFECT');
  });

  test('should validate use command module can be imported', () => {
    // This test ensures the use command module structure is valid
    expect(() => {
      const useCommand = require('../commands/use');
      expect(useCommand.data).toBeDefined();
      expect(useCommand.execute).toBeDefined();
    }).not.toThrow();
  });
});