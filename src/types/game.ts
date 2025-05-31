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
  x?: number; // Grid X coordinate (null when in city/home)
  y?: number; // Grid Y coordinate (null when in city/home)
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
  category?: string;
  subCategory?: string;
  killChance?: number;
  breakChance?: number;
  killCount?: number;
  onBreak?: string;
  broken?: boolean;
}

export enum ItemType {
  WEAPON = 'weapon',
  MELEE = 'melee',
  TOOL = 'tool',
  RESOURCE = 'resource',
  CONSUMABLE = 'consumable',
  BUILDING_MATERIAL = 'building_material'
}

export interface ItemEffect {
  type: string;
  value?: number;
  chance?: number;         // Success chance (0-100)
  breakChance?: number;    // Chance to break on use (0-100)
  transformInto?: string;  // Item to transform into when broken
}

export enum Location {
  CITY = 'city',
  HOME = 'home',
  GATE = 'gate',
  WASTE = 'waste',
  GREATER_WASTE = 'greater_waste',
  FACTORY = 'factory',
  ABANDONED_MANSION = 'abandoned_mansion',
  MODEST_NEIGHBORHOOD = 'modest_neighborhood',
  GATED_COMMUNITY = 'gated_community',
  CONVENIENCE_STORE = 'convenience_store',
  OFFICE_DISTRICT = 'office_district',
  HOSPITAL = 'hospital',
  SCHOOL_CAMPUS = 'school_campus',
  SHOPPING_MALL = 'shopping_mall',
  HOTEL = 'hotel',
  CITY_PARK = 'city_park',
  AMUSEMENT_PARK = 'amusement_park',
  CONSTRUCTION_SITE = 'construction_site',
  RADIO_TOWER = 'radio_tower',
  CAMP_GROUNDS = 'camp_grounds',
  LAKE_SIDE = 'lake_side'
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
  gateOpen: boolean;
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

export interface AreaInventory {
  location: Location;
  items: InventoryItem[];
}

export interface Bank {
  cityId: string;
  items: InventoryItem[];
}

export interface GridCoordinate {
  x: number;
  y: number;
}

export enum Direction {
  NORTH = 'north',
  EAST = 'east',
  SOUTH = 'south',
  WEST = 'west'
}

export interface WorldMapTile {
  x: number;
  y: number;
  location: Location;
  playersPresent: number;
}

export enum ZoneStatus {
  UNCONTESTED = 'uncontested',
  CONTESTED = 'contested', 
  TEMPORARILY_UNCONTESTED = 'temporarily_uncontested'
}

export interface ZoneContest {
  x: number;
  y: number;
  status: ZoneStatus;
  humanCp: number;
  zombieCp: number;
  tempUncontestedUntil?: Date;
  lastUpdated: Date;
}