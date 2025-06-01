// Item Effect System Types
export enum EffectType {
  KILL_ZOMBIE = 'kill_zombie',
  HEAL_PLAYER = 'heal_player',
  REPAIR_BUILDING = 'repair_building',
  PROVIDE_RESOURCE = 'provide_resource',
  TRANSFORM_ITEM = 'transform_item',
  RESTORE_AP = 'restore_ap',
  ADD_STATUS = 'add_status',
  REMOVE_STATUS = 'remove_status'
}

export interface ItemEffect {
  type: EffectType;
  chance?: number;         // Success chance (0-100)
  value?: number;          // Effect magnitude
  breakChance?: number;    // Chance to break on use (0-100)
  transformInto?: string;  // Item to transform into when broken
  status?: string;         // Status/condition to add or remove
}

export interface ItemUseContext {
  player: any;
  location: { x: number, y: number };
  targetPlayer?: any;
  targetBuilding?: any;
}

export interface ItemUseResult {
  success: boolean;
  message: string;
  itemBroken?: boolean;
  transformedInto?: string;
  effectData?: any;
}