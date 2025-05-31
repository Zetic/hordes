import { getItemDefinition, getAllItemDefinitions, itemDefinitions } from '../data/items';
import { EffectType } from '../types/itemEffects';
import { ItemType } from '../types/game';

describe('Item Definitions System', () => {
  describe('getItemDefinition', () => {
    test('should return Box Cutter definition', () => {
      const definition = getItemDefinition('Box Cutter');
      
      expect(definition).toBeDefined();
      expect(definition!.name).toBe('Box Cutter');
      expect(definition!.type).toBe(ItemType.MELEE);
      expect(definition!.effects).toHaveLength(1);
      expect(definition!.effects[0].type).toBe(EffectType.KILL_ZOMBIE);
      expect(definition!.effects[0].chance).toBe(60);
      expect(definition!.effects[0].breakChance).toBe(70);
      expect(definition!.effects[0].transformInto).toBe('Broken Box Cutter');
    });

    test('should return Broken Box Cutter definition', () => {
      const definition = getItemDefinition('Broken Box Cutter');
      
      expect(definition).toBeDefined();
      expect(definition!.name).toBe('Broken Box Cutter');
      expect(definition!.type).toBe(ItemType.MELEE);
      expect(definition!.effects).toHaveLength(0);
    });

    test('should be case insensitive', () => {
      const definition1 = getItemDefinition('box cutter');
      const definition2 = getItemDefinition('BOX CUTTER');
      const definition3 = getItemDefinition('Box Cutter');
      
      expect(definition1).toBeDefined();
      expect(definition2).toBeDefined();
      expect(definition3).toBeDefined();
      expect(definition1!.name).toBe(definition2!.name);
      expect(definition2!.name).toBe(definition3!.name);
    });

    test('should return null for non-existent items', () => {
      const definition = getItemDefinition('Non-existent Item');
      expect(definition).toBeNull();
    });
  });

  describe('getAllItemDefinitions', () => {
    test('should return all item definitions', () => {
      const definitions = getAllItemDefinitions();
      
      expect(definitions).toHaveLength(itemDefinitions.length);
      expect(definitions.some(def => def.name === 'Box Cutter')).toBe(true);
      expect(definitions.some(def => def.name === 'Broken Box Cutter')).toBe(true);
    });

    test('should return a copy to prevent mutations', () => {
      const definitions = getAllItemDefinitions();
      const originalLength = definitions.length;
      
      definitions.push({
        name: 'Test Item',
        type: ItemType.TOOL,
        description: 'Test',
        weight: 1,
        category: 'Test',
        subCategory: 'Test',
        effects: []
      });
      
      const newDefinitions = getAllItemDefinitions();
      expect(newDefinitions).toHaveLength(originalLength);
    });
  });

  describe('Item definition structure', () => {
    test('should have valid structure for all items', () => {
      const definitions = getAllItemDefinitions();
      
      definitions.forEach(def => {
        expect(def.name).toBeDefined();
        expect(def.type).toBeDefined();
        expect(def.description).toBeDefined();
        expect(def.weight).toBeGreaterThan(0);
        expect(def.category).toBeDefined();
        expect(def.subCategory).toBeDefined();
        expect(Array.isArray(def.effects)).toBe(true);
        
        // Validate effects structure
        def.effects.forEach(effect => {
          expect(Object.values(EffectType)).toContain(effect.type);
          if (effect.chance !== undefined) {
            expect(effect.chance).toBeGreaterThanOrEqual(0);
            expect(effect.chance).toBeLessThanOrEqual(100);
          }
          if (effect.breakChance !== undefined) {
            expect(effect.breakChance).toBeGreaterThanOrEqual(0);
            expect(effect.breakChance).toBeLessThanOrEqual(100);
          }
        });
      });
    });
  });
});