// Core game types and interfaces
export enum PlayerStatus {
  HEALTHY = 'healthy',
  WOUNDED = 'wounded',
  DEAD = 'dead'
}

export interface Player {
  id: string;
  discordId: string;
  name: string;
  health: number;
  maxHealth: number;
  status: PlayerStatus;
  actionPoints: number;
  maxActionPoints: number;
  water: number;
  isAlive: boolean;
  location: Location;
  inventory: InventoryItem[];
  lastActionTime: Date;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  weight: number;
  effects?: ItemEffect[];
}

export enum ItemType {
  WEAPON = 'weapon',
  TOOL = 'tool',
  RESOURCE = 'resource',
  CONSUMABLE = 'consumable',
  BUILDING_MATERIAL = 'building_material'
}

export interface ItemEffect {
  type: string;
  value: number;
}

export enum Location {
  CITY = 'city',
  OUTSIDE = 'outside',
  HOME = 'home',
  GREATER_OUTSIDE = 'greater_outside'
}

export interface City {
  id: string;
  name: string;
  defenseLevel: number;
  buildings: Building[];
  resources: CityResource[];
  population: number;
  day: number;
  gamePhase: GamePhase;
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  health: number;
  maxHealth: number;
}

export enum BuildingType {
  WATCHTOWER = 'watchtower',
  WALL = 'wall',
  WORKSHOP = 'workshop',
  WELL = 'well',
  HOSPITAL = 'hospital'
}

export interface CityResource {
  type: ResourceType;
  quantity: number;
}

export enum ResourceType {
  WOOD = 'wood',
  WATER = 'water',
  OIL = 'oil',
  METAL = 'metal'
}

export enum GamePhase {
  PLAY_MODE = 'play_mode',
  HORDE_MODE = 'horde_mode'
}

export interface GameState {
  cityId: string;
  currentDay: number;
  currentPhase: GamePhase;
  lastHordeAttack: Date;
  nextPhaseChange: Date;
  hordeSize: number;
}