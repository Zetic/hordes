import { ItemType } from '../types/game';
import { EffectType } from '../types/itemEffects';

export interface ItemDefinition {
  name: string;
  type: ItemType;
  description: string;
  weight: number;
  category: string;
  subCategory: string;
  effects: Array<{
    type: EffectType;
    chance?: number;
    value?: number;
    breakChance?: number;
    transformInto?: string;
    status?: string;
  }>;
}

export const itemDefinitions: ItemDefinition[] = [
  {
    name: "Box Cutter",
    type: ItemType.MELEE,
    description: "A sharp utility knife that can be used to kill zombies",
    weight: 1,
    category: "Items",
    subCategory: "Armoury",
    effects: [
      {
        type: EffectType.KILL_ZOMBIE,
        chance: 60,
        value: 1,
        breakChance: 70,
        transformInto: "Broken Box Cutter"
      }
    ]
  },
  {
    name: "Broken Box Cutter",
    type: ItemType.MELEE,
    description: "A broken utility knife with no use",
    weight: 1,
    category: "Items",
    subCategory: "Armoury",
    effects: [] // No effects for broken items
  },
  {
    name: "Water Ration",
    type: ItemType.CONSUMABLE,
    description: "A small bottle of clean water that restores action points and provides hydration",
    weight: 1,
    category: "Items",
    subCategory: "Hydration",
    effects: [
      {
        type: EffectType.RESTORE_AP,
        value: 10
      },
      {
        type: EffectType.ADD_STATUS,
        status: "refreshed"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "thirsty"
      }
    ]
  },
  {
    name: "Stale Tart",
    type: ItemType.CONSUMABLE,
    description: "An old pastry that still provides nutrition and energy",
    weight: 1,
    category: "Items",
    subCategory: "Nutrition",
    effects: [
      {
        type: EffectType.RESTORE_AP,
        value: 10
      },
      {
        type: EffectType.ADD_STATUS,
        status: "fed"
      }
    ]
  }
  // More items can be added here as the system grows
];

export function getItemDefinition(itemName: string): ItemDefinition | null {
  return itemDefinitions.find(def => def.name.toLowerCase() === itemName.toLowerCase()) || null;
}

export function getAllItemDefinitions(): ItemDefinition[] {
  return [...itemDefinitions]; // Return a copy to prevent mutations
}