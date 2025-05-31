// Quick test to verify new items and status system works
import { itemDefinitions, getItemDefinition } from '../data/items';
import { EffectType } from '../types/itemEffects';
import { PlayerStatus } from '../types/game';

describe('New Items and Status System', () => {
  test('Water Ration should be defined with correct effects', () => {
    const waterRation = getItemDefinition('Water Ration');
    expect(waterRation).toBeDefined();
    expect(waterRation?.category).toBe('Items');
    expect(waterRation?.subCategory).toBe('Hydration');
    expect(waterRation?.effects).toHaveLength(4);
    
    // Check for restore AP effect
    const restoreAPEffect = waterRation?.effects.find(e => e.type === EffectType.RESTORE_AP);
    expect(restoreAPEffect).toBeDefined();
    expect(restoreAPEffect?.value).toBe(10);
    
    // Check for add refreshed status effect
    const addRefreshedEffect = waterRation?.effects.find(e => e.type === EffectType.ADD_STATUS && e.status === 'refreshed');
    expect(addRefreshedEffect).toBeDefined();
    
    // Check for remove thirsty status effect
    const removeThirstyEffect = waterRation?.effects.find(e => e.type === EffectType.REMOVE_STATUS && e.status === 'thirsty');
    expect(removeThirstyEffect).toBeDefined();
  });

  test('Stale Tart should be defined with correct effects', () => {
    const staleTart = getItemDefinition('Stale Tart');
    expect(staleTart).toBeDefined();
    expect(staleTart?.category).toBe('Items');
    expect(staleTart?.subCategory).toBe('Nutrition');
    expect(staleTart?.effects).toHaveLength(3);
    
    // Check for restore AP effect
    const restoreAPEffect = staleTart?.effects.find(e => e.type === EffectType.RESTORE_AP);
    expect(restoreAPEffect).toBeDefined();
    expect(restoreAPEffect?.value).toBe(10);
    
    // Check for add fed status effect
    const addFedEffect = staleTart?.effects.find(e => e.type === EffectType.ADD_STATUS && e.status === 'fed');
    expect(addFedEffect).toBeDefined();
  });

  test('New PlayerStatus values should be available', () => {
    expect(PlayerStatus.REFRESHED).toBe('refreshed');
    expect(PlayerStatus.FED).toBe('fed');
    expect(PlayerStatus.THIRSTY).toBe('thirsty');
    expect(PlayerStatus.DEHYDRATED).toBe('dehydrated');
    expect(PlayerStatus.EXHAUSTED).toBe('exhausted');
  });

  test('All items should have valid structure', () => {
    itemDefinitions.forEach(item => {
      expect(item.name).toBeDefined();
      expect(item.type).toBeDefined();
      expect(item.category).toBeDefined();
      expect(item.subCategory).toBeDefined();
      expect(Array.isArray(item.effects)).toBe(true);
      
      // Each effect should have a valid type
      item.effects.forEach(effect => {
        expect(Object.values(EffectType)).toContain(effect.type);
      });
    });
  });
});