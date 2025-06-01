// Core game types and interfaces

// Player status including both vital status and temporary conditions
export enum PlayerStatus {
  // Vital statuses (mutually exclusive, based on health/life state)
  ALIVE = 'alive',
  DEAD = 'dead',
  
  // Wound types (mutually exclusive, based on injury)
  WOUNDED_ARM = 'wounded_arm',
  WOUNDED_EYE = 'wounded_eye', 
  WOUNDED_FOOT = 'wounded_foot',
  WOUNDED_HAND = 'wounded_hand',
  WOUNDED_HEAD = 'wounded_head',
  WOUNDED_LEG = 'wounded_leg',
  
  // Temporary conditions (can have multiple simultaneously)
  REFRESHED = 'refreshed',
  FED = 'fed',
  THIRSTY = 'thirsty',
  DEHYDRATED = 'dehydrated',
  EXHAUSTED = 'exhausted',
  HEALED = 'healed',
  INFECTED = 'infected',
  SCAVENGING = 'scavenging'
}

// Helper to categorize status types
export const VitalStatuses = [
  PlayerStatus.ALIVE,
  PlayerStatus.DEAD
] as const;

export const WoundTypes = [
  PlayerStatus.WOUNDED_ARM,
  PlayerStatus.WOUNDED_EYE,
  PlayerStatus.WOUNDED_FOOT,
  PlayerStatus.WOUNDED_HAND,
  PlayerStatus.WOUNDED_HEAD,
  PlayerStatus.WOUNDED_LEG
] as const;

export const TemporaryConditions = [
  PlayerStatus.REFRESHED,
  PlayerStatus.FED,
  PlayerStatus.THIRSTY,
  PlayerStatus.DEHYDRATED,
  PlayerStatus.EXHAUSTED,
  PlayerStatus.HEALED,
  PlayerStatus.INFECTED,
  PlayerStatus.SCAVENGING
] as const;

export function isVitalStatus(status: PlayerStatus): boolean {
  return VitalStatuses.includes(status as any);
}

export function isWoundType(status: PlayerStatus): boolean {
  return WoundTypes.includes(status as any);
}

export function isTemporaryCondition(status: PlayerStatus): boolean {
  return TemporaryConditions.includes(status as any);
}

export interface Player {
  id: string;
  discordId: string;
  name: string;
  health: number;
  maxHealth: number;
  status: PlayerStatus; // Vital status only (healthy, wounded, dead)
  conditions: PlayerStatus[]; // Array of temporary conditions
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
  // New POIs for scavenging system
  ABANDONED_BUNKER = 'abandoned_bunker',
  ABANDONED_CONSTRUCTION_SITE = 'abandoned_construction_site',
  ABANDONED_HOSPITAL = 'abandoned_hospital',
  ABANDONED_HOTEL = 'abandoned_hotel',
  ABANDONED_PARK = 'abandoned_park',
  ABANDONED_WELL = 'abandoned_well',
  AMBULANCE = 'ambulance',
  ARMY_OUTPOST = 'army_outpost',
  BLOCKED_ROAD = 'blocked_road',
  BROKEN_DOWN_TANK = 'broken_down_tank',
  BURNT_SCHOOL = 'burnt_school',
  CAVE = 'cave',
  CITIZENS_HOME = 'citizens_home',
  CITIZENS_TENT = 'citizens_tent',
  COLLAPSED_MINESHAFT = 'collapsed_mineshaft',
  COLLAPSED_QUARRY = 'collapsed_quarry',
  CONSTRUCTION_SITE_SHELTER = 'construction_site_shelter',
  COSMETICS_LAB = 'cosmetics_lab',
  CROWSFIT_GYM = 'crowsfit_gym',
  DARK_WOODS = 'dark_woods',
  DERELICT_VILLA = 'derelict_villa',
  DESERTED_FREIGHT_YARD = 'deserted_freight_yard',
  DESTROYED_PHARMACY = 'destroyed_pharmacy',
  DILAPIDATED_BUILDING = 'dilapidated_building',
  DISUSED_CAR_PARK = 'disused_car_park',
  DISUSED_SILOS = 'disused_silos',
  DISUSED_WAREHOUSE = 'disused_warehouse',
  DUKES_VILLA = 'dukes_villa',
  EQUIPPED_TRENCH = 'equipped_trench',
  FAIRGROUND_STALL = 'fairground_stall',
  FAMILY_TOMB = 'family_tomb',
  FAST_FOOD_RESTAURANT = 'fast_food_restaurant',
  FRASER_DS_KEBAB_ISH = 'fraser_ds_kebab_ish',
  GARDEN_SHED = 'garden_shed',
  GUNS_N_ZOMBIES_ARMOURY = 'guns_n_zombies_armoury',
  HOME_DEPOT = 'home_depot',
  INDIAN_BURIAL_GROUND = 'indian_burial_ground',
  LOOTED_SUPERMARKET = 'looted_supermarket',
  MACS_ATOMIC_CAFE = 'macs_atomic_cafe',
  MINI_MARKET = 'mini_market',
  MOTEL_666_DUSK = 'motel_666_dusk',
  MOTORWAY_SERVICES = 'motorway_services',
  NUCLEAR_BUNKER = 'nuclear_bunker',
  OLD_AERODROME = 'old_aerodrome',
  OLD_BICYCLE_HIRE_SHOP = 'old_bicycle_hire_shop',
  OLD_FIELD_HOSPITAL = 'old_field_hospital',
  OLD_HYDRAULIC_PUMP = 'old_hydraulic_pump',
  OLD_POLICE_STATION = 'old_police_station',
  ONCE_INHABITED_CAVE = 'once_inhabited_cave',
  PI_KEYA_FURNITURE = 'pi_keya_furniture',
  PLANE_CRASH_SITE = 'plane_crash_site',
  POST_OFFICE = 'post_office',
  SCOTTISH_SMITHS_SUPERSTORE = 'scottish_smiths_superstore',
  SHADY_BAR = 'shady_bar',
  SMALL_HOUSE = 'small_house',
  SMUGGLERS_CACHE = 'smugglers_cache',
  STRANGE_CIRCULAR_DEVICE = 'strange_circular_device',
  THE_MAYOR_MOBILE = 'the_mayor_mobile',
  THE_SHATTERED_ILLUSIONS_BAR = 'the_shattered_illusions_bar',
  TOWN_LIBRARY = 'town_library',
  WAREHOUSE = 'warehouse',
  WATER_PROCESSING_PLANT = 'water_processing_plant',
  WRECKED_CARS = 'wrecked_cars',
  WRECKED_TRANSPORTER = 'wrecked_transporter'
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