import { Location, Direction, GridCoordinate, WorldMapTile } from '../types/game';
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import * as path from 'path';
import { DatabaseService } from './database';
import { ZombieService, ThreatLevel } from './zombieService';

export enum TileState {
  HIDDEN = 'hidden',
  EXPLORED = 'explored', 
  TOWN = 'town',
  POI = 'poi'
}

export interface POILocation {
  x: number;
  y: number;
  location: Location;
}

export class WorldMapService {
  private static instance: WorldMapService;
  private db: DatabaseService;
  private zombieService: ZombieService;
  
  // 13x13 grid with center at (6,6) = GATE/TOWN
  private readonly MAP_SIZE = 13;
  private readonly CENTER_X = 6;
  private readonly CENTER_Y = 6;
  
  // Tile configuration
  private readonly TILE_SIZE = 16;
  private readonly TILES_DIR = path.join(__dirname, '../../tiles');
  
  // Grid tile filenames for the new system
  private readonly GRID_TILES = {
    [TileState.HIDDEN]: 'grid_hidden.png',
    [TileState.EXPLORED]: 'grid_explored.png',
    [TileState.TOWN]: 'grid_town.png',
    [TileState.POI]: 'grid_poi.png'
  };
  
  private readonly THREAT_TILES = {
    low: 'grid_threat_low.png',
    medium: 'grid_threat_medium.png',
    high: 'grid_threat_high.png'
  };
  
  private readonly PLAYER_TILE = 'grid_player.png';
  
  // POI locations (7 special locations during world generation)
  private poiLocations: POILocation[] = [];
  
  // Track explored tiles
  private exploredTiles: Set<string> = new Set();

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.zombieService = ZombieService.getInstance();
    // Initialize synchronously - async part will be handled in getInstance
  }

  static getInstance(): WorldMapService {
    if (!WorldMapService.instance) {
      WorldMapService.instance = new WorldMapService();
      // Initialize map asynchronously
      WorldMapService.instance.initializeMap().catch(error => {
        console.error('Error during map initialization:', error);
      });
    }
    return WorldMapService.instance;
  }

  // Initialize the map with starting state
  private async initializeMap() {
    // Clear any existing in-memory state
    this.exploredTiles.clear();
    this.poiLocations = [];
    
    // Load explored tiles from database
    await this.loadExploredTilesFromDB();
    
    // If no explored tiles in DB, initialize with default starting area
    if (this.exploredTiles.size === 0) {
      await this.initializeStartingArea();
    }
    
    // Generate 7 POI locations during world gen
    this.generatePOILocations();
  }
  
  // Load explored tiles from database
  private async loadExploredTilesFromDB(): Promise<void> {
    try {
      const query = 'SELECT x, y FROM explored_tiles';
      const result = await this.db.pool.query(query);
      
      for (const row of result.rows) {
        this.exploredTiles.add(`${row.x},${row.y}`);
      }
      
      if (result.rows.length > 0) {
        console.log(`📍 Loaded ${result.rows.length} explored tiles from database`);
      }
    } catch (error) {
      console.error('Error loading explored tiles from database:', error);
    }
  }
  
  // Initialize starting explored area
  private async initializeStartingArea(): Promise<void> {
    try {
      // Add center town tile
      await this.markTileExploredPersistent(this.CENTER_X, this.CENTER_Y);
      
      // Add 8 surrounding explored tiles around center (starting area)
      const surroundingOffsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      
      for (const [dx, dy] of surroundingOffsets) {
        const x = this.CENTER_X + dx;
        const y = this.CENTER_Y + dy;
        if (this.isValidCoordinate(x, y)) {
          await this.markTileExploredPersistent(x, y);
        }
      }
      
      console.log('✅ Initialized starting explored area');
    } catch (error) {
      console.error('Error initializing starting area:', error);
      // Fallback to in-memory initialization only
      this.exploredTiles.add(`${this.CENTER_X},${this.CENTER_Y}`);
      const surroundingOffsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      
      for (const [dx, dy] of surroundingOffsets) {
        const x = this.CENTER_X + dx;
        const y = this.CENTER_Y + dy;
        if (this.isValidCoordinate(x, y)) {
          this.exploredTiles.add(`${x},${y}`);
        }
      }
      console.log('✅ Initialized starting explored area (in-memory fallback)');
    }
  }
  
  // Generate 7 POI locations for the world
  private generatePOILocations() {
    const poiLocationTypes = [
      Location.ABANDONED_BUNKER,
      Location.ABANDONED_HOSPITAL,
      Location.AMBULANCE,
      Location.ARMY_OUTPOST,
      Location.BURNT_SCHOOL,
      Location.CAVE,
      Location.CITIZENS_HOME
    ];
    
    const usedCoordinates = new Set<string>();
    
    // Add center and immediate surrounding area to used coordinates
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = this.CENTER_X + dx;
        const y = this.CENTER_Y + dy;
        if (this.isValidCoordinate(x, y)) {
          usedCoordinates.add(`${x},${y}`);
        }
      }
    }
    
    // Generate random POI locations
    for (let i = 0; i < 7; i++) {
      let attempts = 0;
      let x, y;
      
      do {
        x = Math.floor(Math.random() * this.MAP_SIZE);
        y = Math.floor(Math.random() * this.MAP_SIZE);
        attempts++;
      } while (usedCoordinates.has(`${x},${y}`) && attempts < 100);
      
      if (attempts < 100) {
        this.poiLocations.push({
          x,
          y,
          location: poiLocationTypes[i]
        });
        usedCoordinates.add(`${x},${y}`);
      }
    }
  }

  // Get the location type for a given coordinate
  getLocationAtCoordinate(x: number, y: number): Location {
    // Bounds check
    if (!this.isValidCoordinate(x, y)) {
      throw new Error('Coordinates out of bounds');
    }

    // Center is the gate/town
    if (x === this.CENTER_X && y === this.CENTER_Y) {
      return Location.GATE;
    }

    // Check if this coordinate is a POI location
    const poi = this.poiLocations.find(p => p.x === x && p.y === y);
    if (poi) {
      return poi.location;
    }

    // All other locations are considered waste (for movement/resource purposes)
    return Location.WASTE;
  }

  // Get coordinates for a direction move
  getCoordinateInDirection(currentX: number, currentY: number, direction: Direction): GridCoordinate {
    let newX = currentX;
    let newY = currentY;

    switch (direction) {
      case Direction.NORTH:
        newY = currentY - 1;
        break;
      case Direction.EAST:
        newX = currentX + 1;
        break;
      case Direction.SOUTH:
        newY = currentY + 1;
        break;
      case Direction.WEST:
        newX = currentX - 1;
        break;
    }

    return { x: newX, y: newY };
  }

  // Check if coordinates are valid (within map bounds)
  isValidCoordinate(x: number, y: number): boolean {
    return x >= 0 && x < this.MAP_SIZE && y >= 0 && y < this.MAP_SIZE;
  }

  // Get the map size
  getMapSize(): number {
    return this.MAP_SIZE;
  }
  
  // Get tile state for rendering
  getTileState(x: number, y: number): TileState {
    if (x === this.CENTER_X && y === this.CENTER_Y) {
      return TileState.TOWN;
    }
    
    if (this.exploredTiles.has(`${x},${y}`)) {
      // Check if this is a POI that has been discovered
      const poi = this.poiLocations.find(p => p.x === x && p.y === y);
      if (poi) {
        return TileState.POI;
      }
      return TileState.EXPLORED;
    }
    
    return TileState.HIDDEN;
  }
  
  // Mark a tile as explored when a player moves there
  markTileExplored(x: number, y: number): void {
    if (this.isValidCoordinate(x, y)) {
      this.exploredTiles.add(`${x},${y}`);
      // Also persist to database (fire and forget)
      this.markTileExploredPersistent(x, y).catch(error => {
        console.error('Failed to persist explored tile:', error);
      });
    }
  }
  
  // Mark a tile as explored with database persistence
  private async markTileExploredPersistent(x: number, y: number): Promise<void> {
    try {
      this.exploredTiles.add(`${x},${y}`);
      
      const query = `
        INSERT INTO explored_tiles (x, y) 
        VALUES ($1, $2) 
        ON CONFLICT (x, y) DO NOTHING
      `;
      await this.db.pool.query(query, [x, y]);
    } catch (error) {
      console.error('Error persisting explored tile:', error);
    }
  }
  
  // Reset the map to initial state
  async resetMap(): Promise<void> {
    try {
      // Clear explored tiles from database
      await this.db.pool.query('DELETE FROM explored_tiles');
      console.log('✅ Cleared explored tiles from database');
      
      // Clear zombies from database
      await this.zombieService.clearAllZombies();
      
      // Reinitialize the map
      await this.initializeMap();
      
      // Initialize zombies for new world
      await this.zombieService.initializeWorldZombies();
      
      console.log('✅ Map reset complete');
    } catch (error) {
      console.error('Error resetting map:', error);
      // Fallback to in-memory reset only
      this.exploredTiles.clear();
      this.poiLocations = [];
      this.generatePOILocations();
      
      // Initialize starting area in-memory only
      this.exploredTiles.add(`${this.CENTER_X},${this.CENTER_Y}`);
      const surroundingOffsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      
      for (const [dx, dy] of surroundingOffsets) {
        const x = this.CENTER_X + dx;
        const y = this.CENTER_Y + dy;
        if (this.isValidCoordinate(x, y)) {
          this.exploredTiles.add(`${x},${y}`);
        }
      }
    }
  }

  // Get gate coordinates
  getGateCoordinates(): GridCoordinate {
    return { x: this.CENTER_X, y: this.CENTER_Y };
  }

  // Get directional name for display
  getDirectionDisplayName(direction: Direction): string {
    const names = {
      [Direction.NORTH]: 'North',
      [Direction.EAST]: 'East',
      [Direction.SOUTH]: 'South',
      [Direction.WEST]: 'West'
    };
    return names[direction];
  }

  // Get location display name and emoji
  getLocationDisplay(location: Location): { name: string; emoji: string } {
    switch (location) {
      case Location.GATE:
        return { name: 'Gate', emoji: '🚪' };
      case Location.WASTE:
        return { name: 'Waste', emoji: '🌲' };
      case Location.CITY:
        return { name: 'City', emoji: '🏠' };
      case Location.HOME:
        return { name: 'Home', emoji: '🏡' };
      // New POI locations
      case Location.ABANDONED_BUNKER:
        return { name: 'Abandoned Bunker', emoji: '🏚️' };
      case Location.ABANDONED_CONSTRUCTION_SITE:
        return { name: 'Abandoned Construction Site', emoji: '🏗️' };
      case Location.ABANDONED_HOSPITAL:
        return { name: 'Abandoned Hospital', emoji: '🏥' };
      case Location.ABANDONED_HOTEL:
        return { name: 'Abandoned Hotel', emoji: '🏨' };
      case Location.ABANDONED_PARK:
        return { name: 'Abandoned Park', emoji: '🌳' };
      case Location.ABANDONED_WELL:
        return { name: 'Abandoned Well', emoji: '🗿' };
      case Location.AMBULANCE:
        return { name: 'Ambulance', emoji: '🚑' };
      case Location.ARMY_OUTPOST:
        return { name: 'Army Outpost', emoji: '⚔️' };
      case Location.BLOCKED_ROAD:
        return { name: 'Blocked Road', emoji: '🚧' };
      case Location.BROKEN_DOWN_TANK:
        return { name: 'Broken-down Tank', emoji: '🛡️' };
      case Location.BURNT_SCHOOL:
        return { name: 'Burnt School', emoji: '🏫' };
      case Location.CAVE:
        return { name: 'Cave', emoji: '🕳️' };
      case Location.CITIZENS_HOME:
        return { name: "Citizen's Home", emoji: '🏠' };
      case Location.CITIZENS_TENT:
        return { name: "Citizen's Tent", emoji: '⛺' };
      case Location.COLLAPSED_MINESHAFT:
        return { name: 'Collapsed Mineshaft', emoji: '⛏️' };
      case Location.COLLAPSED_QUARRY:
        return { name: 'Collapsed Quarry', emoji: '🗻' };
      case Location.CONSTRUCTION_SITE_SHELTER:
        return { name: 'Construction Site Shelter', emoji: '🏗️' };
      case Location.COSMETICS_LAB:
        return { name: 'Cosmetics Lab', emoji: '💄' };
      case Location.CROWSFIT_GYM:
        return { name: "Crows'fit Gym", emoji: '💪' };
      case Location.DARK_WOODS:
        return { name: 'Dark Woods', emoji: '🌲' };
      case Location.DERELICT_VILLA:
        return { name: 'Derelict Villa', emoji: '🏚️' };
      case Location.DESERTED_FREIGHT_YARD:
        return { name: 'Deserted Freight Yard', emoji: '🚛' };
      case Location.DESTROYED_PHARMACY:
        return { name: 'Destroyed Pharmacy', emoji: '💊' };
      case Location.DILAPIDATED_BUILDING:
        return { name: 'Dilapidated Building', emoji: '🏚️' };
      case Location.DISUSED_CAR_PARK:
        return { name: 'Disused Car Park', emoji: '🅿️' };
      case Location.DISUSED_SILOS:
        return { name: 'Disused Silos', emoji: '🏭' };
      case Location.DISUSED_WAREHOUSE:
        return { name: 'Disused Warehouse', emoji: '🏭' };
      case Location.DUKES_VILLA:
        return { name: "Duke's Villa", emoji: '🏰' };
      case Location.EQUIPPED_TRENCH:
        return { name: 'Equipped Trench', emoji: '⚔️' };
      case Location.FAIRGROUND_STALL:
        return { name: 'Fairground Stall', emoji: '🎪' };
      case Location.FAMILY_TOMB:
        return { name: 'Family Tomb', emoji: '⚰️' };
      case Location.FAST_FOOD_RESTAURANT:
        return { name: 'Fast Food Restaurant', emoji: '🍔' };
      case Location.FRASER_DS_KEBAB_ISH:
        return { name: "Fraser D's Kebab-ish", emoji: '🥙' };
      case Location.GARDEN_SHED:
        return { name: 'Garden Shed', emoji: '🏚️' };
      case Location.GUNS_N_ZOMBIES_ARMOURY:
        return { name: "Guns 'n' Zombies Armoury", emoji: '🔫' };
      case Location.HOME_DEPOT:
        return { name: 'Home Depot', emoji: '🔨' };
      case Location.INDIAN_BURIAL_GROUND:
        return { name: 'Indian Burial Ground', emoji: '🪦' };
      case Location.LOOTED_SUPERMARKET:
        return { name: 'Looted Supermarket', emoji: '🏪' };
      case Location.MACS_ATOMIC_CAFE:
        return { name: "Mac's Atomic Cafe", emoji: '☕' };
      case Location.MINI_MARKET:
        return { name: 'Mini-Market', emoji: '🏪' };
      case Location.MOTEL_666_DUSK:
        return { name: 'Motel 666 Dusk', emoji: '🏨' };
      case Location.MOTORWAY_SERVICES:
        return { name: 'Motorway Services', emoji: '⛽' };
      case Location.NUCLEAR_BUNKER:
        return { name: 'Nuclear Bunker', emoji: '☢️' };
      case Location.OLD_AERODROME:
        return { name: 'Old Aerodrome', emoji: '✈️' };
      case Location.OLD_BICYCLE_HIRE_SHOP:
        return { name: 'Old Bicycle Hire Shop', emoji: '🚲' };
      case Location.OLD_FIELD_HOSPITAL:
        return { name: 'Old Field Hospital', emoji: '🏥' };
      case Location.OLD_HYDRAULIC_PUMP:
        return { name: 'Old Hydraulic Pump', emoji: '🔧' };
      case Location.OLD_POLICE_STATION:
        return { name: 'Old Police Station', emoji: '🚔' };
      case Location.ONCE_INHABITED_CAVE:
        return { name: 'Once-inhabited Cave', emoji: '🕳️' };
      case Location.PI_KEYA_FURNITURE:
        return { name: 'PI-KEYA Furniture', emoji: '🪑' };
      case Location.PLANE_CRASH_SITE:
        return { name: 'Plane Crash Site', emoji: '✈️' };
      case Location.POST_OFFICE:
        return { name: 'Post Office', emoji: '📮' };
      case Location.SCOTTISH_SMITHS_SUPERSTORE:
        return { name: "Scottish Smith's Superstore", emoji: '🏪' };
      case Location.SHADY_BAR:
        return { name: 'Shady Bar', emoji: '🍺' };
      case Location.SMALL_HOUSE:
        return { name: 'Small House', emoji: '🏠' };
      case Location.SMUGGLERS_CACHE:
        return { name: "Smugglers' Cache", emoji: '📦' };
      case Location.STRANGE_CIRCULAR_DEVICE:
        return { name: 'Strange Circular Device', emoji: '🛸' };
      case Location.THE_MAYOR_MOBILE:
        return { name: "The 'Mayor-Mobile'", emoji: '🚗' };
      case Location.THE_SHATTERED_ILLUSIONS_BAR:
        return { name: "The 'Shattered Illusions' Bar", emoji: '🍻' };
      case Location.TOWN_LIBRARY:
        return { name: 'Town Library', emoji: '📚' };
      case Location.WAREHOUSE:
        return { name: 'Warehouse', emoji: '🏭' };
      case Location.WATER_PROCESSING_PLANT:
        return { name: 'Water Processing Plant', emoji: '💧' };
      case Location.WRECKED_CARS:
        return { name: 'Wrecked Cars', emoji: '🚗' };
      case Location.WRECKED_TRANSPORTER:
        return { name: 'Wrecked Transporter', emoji: '🚛' };
      default:
        return { name: 'Unknown', emoji: '❓' };
    }
  }

  // Generate a composite image representation of the full map (three layers)
  async generateMapView(playerService?: any): Promise<Buffer> {
    const canvasWidth = this.MAP_SIZE * this.TILE_SIZE;
    const canvasHeight = this.MAP_SIZE * this.TILE_SIZE;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Render the full 13x13 map
    for (let y = 0; y < this.MAP_SIZE; y++) {
      for (let x = 0; x < this.MAP_SIZE; x++) {
        const destX = x * this.TILE_SIZE;
        const destY = y * this.TILE_SIZE;
        
        try {
          // Layer 1: Base tile (grid_explored, grid_hidden, grid_town, grid_poi)
          const tileState = this.getTileState(x, y);
          const baseTileFilename = this.GRID_TILES[tileState];
          const baseTilePath = path.join(this.TILES_DIR, baseTileFilename);
          const baseTileImage = await loadImage(baseTilePath);
          ctx.drawImage(baseTileImage, destX, destY, this.TILE_SIZE, this.TILE_SIZE);
          
          // Layer 2: Threat level overlay based on zombie count (only for explored tiles)
          if (tileState !== TileState.HIDDEN) {
            try {
              const threatLevel = await this.zombieService.getThreatLevelAtLocation(x, y);
              if (threatLevel !== ThreatLevel.NONE) {
                const threatTileFilename = this.THREAT_TILES[threatLevel];
                const threatTilePath = path.join(this.TILES_DIR, threatTileFilename);
                const threatTileImage = await loadImage(threatTilePath);
                ctx.drawImage(threatTileImage, destX, destY, this.TILE_SIZE, this.TILE_SIZE);
              }
            } catch (error) {
              // If threat tiles fail to load, continue without them
              console.warn(`Failed to load threat tile for coordinate (${x}, ${y}):`, error);
            }
          }
          
          // Layer 3: Player markers
          if (playerService) {
            try {
              const playersAtLocation = await playerService.getPlayersByCoordinates(x, y);
              if (playersAtLocation.length > 0) {
                const playerTilePath = path.join(this.TILES_DIR, this.PLAYER_TILE);
                const playerImage = await loadImage(playerTilePath);
                ctx.drawImage(playerImage, destX, destY, this.TILE_SIZE, this.TILE_SIZE);
              }
            } catch (error) {
              // If playerService fails, continue without player markers
              console.warn('Failed to check players at coordinates:', error);
            }
          }
          
        } catch (error) {
          console.error(`Failed to load tiles for coordinate (${x}, ${y}):`, error);
          // Draw a red square as fallback
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(destX, destY, this.TILE_SIZE, this.TILE_SIZE);
        }
      }
    }

    return canvas.toBuffer('image/png');
  }
}