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
    description: "A bottle of clean water that restores action points and hydration",
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
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "exhausted"
      }
    ]
  },
  {
    name: "Stale Tart",
    type: ItemType.CONSUMABLE,
    description: "An old pastry that provides some nutrition and energy",
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
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "exhausted"
      }
    ]
  },
  {
    name: "Bandage",
    type: ItemType.CONSUMABLE,
    description: "A medical bandage that can heal wounds and provide healing effect",
    weight: 1,
    category: "Items",
    subCategory: "Medical",
    effects: [
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_arm"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_eye"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_foot"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_hand"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_head"
      },
      {
        type: EffectType.REMOVE_STATUS,
        status: "wounded_leg"
      },
      {
        type: EffectType.ADD_STATUS,
        status: "healed"
      }
    ]
  },
  // Resource items for scavenging system
  {
    name: "Rotten Log",
    type: ItemType.RESOURCE,
    description: "A decaying piece of wood, barely usable",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Scrap Metal",
    type: ItemType.RESOURCE,
    description: "Small pieces of rusty metal that could be useful",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Wrought Metal",
    type: ItemType.RESOURCE,
    description: "Sturdy metal pieces worked into useful shapes",
    weight: 3,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Twisted Plank",
    type: ItemType.RESOURCE,
    description: "A warped wooden plank, still structurally sound",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Patchwork Beam",
    type: ItemType.RESOURCE,
    description: "A reinforced beam made from various materials",
    weight: 4,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Metal Support",
    type: ItemType.RESOURCE,
    description: "A heavy metal beam suitable for construction",
    weight: 5,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Bag of Damp Grass",
    type: ItemType.RESOURCE,
    description: "A collection of moist grass, potentially useful",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Battery",
    type: ItemType.RESOURCE,
    description: "An old battery that might still hold some charge",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Belt",
    type: ItemType.RESOURCE,
    description: "A worn leather belt, useful for various purposes",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Broken Staff",
    type: ItemType.RESOURCE,
    description: "The remains of what was once a sturdy wooden staff",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Compact Detonator",
    type: ItemType.RESOURCE,
    description: "A small explosive device trigger mechanism",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Convex Lens",
    type: ItemType.RESOURCE,
    description: "A curved glass lens that focuses light",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Copper Pipe",
    type: ItemType.RESOURCE,
    description: "A section of copper piping, tarnished but functional",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Duct Tape",
    type: ItemType.RESOURCE,
    description: "Strong adhesive tape, the universal fix-all",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Earplugs",
    type: ItemType.RESOURCE,
    description: "Small foam plugs for noise protection",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Electronic Component",
    type: ItemType.RESOURCE,
    description: "A salvaged piece of electronic circuitry",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Empty Oil Can",
    type: ItemType.RESOURCE,
    description: "A metal can that once held oil, now empty but useful",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Handful of Nuts and Bolts",
    type: ItemType.RESOURCE,
    description: "Assorted small hardware pieces",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Laser Diode",
    type: ItemType.RESOURCE,
    description: "A precision electronic component for light emission",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Semtex",
    type: ItemType.RESOURCE,
    description: "A malleable plastic explosive compound",
    weight: 1,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Telescope",
    type: ItemType.RESOURCE,
    description: "An optical instrument for viewing distant objects",
    weight: 3,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  },
  {
    name: "Wire Reel",
    type: ItemType.RESOURCE,
    description: "A spool of electrical wire for various applications",
    weight: 2,
    category: "Resources",
    subCategory: "Resources",
    effects: []
  }
  // More items can be added here as the system grows
];

export function getItemDefinition(itemName: string): ItemDefinition | null {
  return itemDefinitions.find(def => def.name.toLowerCase() === itemName.toLowerCase()) || null;
}

export function getAllItemDefinitions(): ItemDefinition[] {
  return [...itemDefinitions]; // Return a copy to prevent mutations
}