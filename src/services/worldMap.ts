import { Location, Direction, GridCoordinate, WorldMapTile } from '../types/game';
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
import * as path from 'path';

export class WorldMapService {
  private static instance: WorldMapService;
  
  // 7x7 grid with center at (3,3) = GATE
  private readonly MAP_SIZE = 7;
  private readonly CENTER_X = 3;
  private readonly CENTER_Y = 3;
  
  // Tile configuration
  private readonly TILE_SIZE = 64;
  private readonly TILES_DIR = path.join(__dirname, '../../tiles');
  
  // Mapping of Location enum to tile filenames
  private readonly LOCATION_TILES: Record<Location, string> = {
    [Location.GATE]: 'z_gate.png',
    [Location.WASTE]: 'z_evergreen_tree.png',
    [Location.GREATER_WASTE]: 'z_evergreen_tree.png',
    [Location.CITY]: 'z_house.png', // Not used in map but needed for completeness
    [Location.HOME]: 'z_house_with_garden.png', // Not used in map but needed for completeness
    [Location.FACTORY]: 'factory.png',
    [Location.ABANDONED_MANSION]: 'z_house_abandoned.png',
    [Location.MODEST_NEIGHBORHOOD]: 'z_house.png',
    [Location.GATED_COMMUNITY]: 'z_house_with_garden.png',
    [Location.CONVENIENCE_STORE]: 'z_convience_store.png',
    [Location.OFFICE_DISTRICT]: 'z_office.png',
    [Location.HOSPITAL]: 'z_hospital.png',
    [Location.SCHOOL_CAMPUS]: 'z_school.png',
    [Location.SHOPPING_MALL]: 'z_department_store.png',
    [Location.HOTEL]: 'z_hotel.png',
    [Location.CITY_PARK]: 'z_fountain.png',
    [Location.AMUSEMENT_PARK]: 'z_ferris_wheel.png',
    [Location.CONSTRUCTION_SITE]: 'z_construction_site.png',
    [Location.RADIO_TOWER]: 'z_tokyo_tower.png',
    [Location.CAMP_GROUNDS]: 'z_campsite.png',
    [Location.LAKE_SIDE]: 'z_pond.png'
  };
  
  private readonly PLAYER_TILE = 'z_player.png';

  private constructor() {}

  static getInstance(): WorldMapService {
    if (!WorldMapService.instance) {
      WorldMapService.instance = new WorldMapService();
    }
    return WorldMapService.instance;
  }

  // Get the location type for a given coordinate
  getLocationAtCoordinate(x: number, y: number): Location {
    // Bounds check
    if (x < 0 || x >= this.MAP_SIZE || y < 0 || y >= this.MAP_SIZE) {
      throw new Error('Coordinates out of bounds');
    }

    // Center is the gate
    if (x === this.CENTER_X && y === this.CENTER_Y) {
      return Location.GATE;
    }

    // Map specific locations according to the map layout
    // Factory
    if (x === 0 && y === 0) {
      return Location.FACTORY;
    }
    
    // Abandoned Mansion
    if (x === 3 && y === 1) {
      return Location.ABANDONED_MANSION;
    }
    
    // Modest Neighborhood
    if (x === 0 && y === 3) {
      return Location.MODEST_NEIGHBORHOOD;
    }
    
    // Convenience Store Street
    if (x === 1 && y === 3) {
      return Location.CONVENIENCE_STORE;
    }
    
    // Gated Community
    if (x === 0 && y === 4) {
      return Location.GATED_COMMUNITY;
    }
    
    // School Campus
    if (x === 1 && y === 4) {
      return Location.SCHOOL_CAMPUS;
    }
    
    // Office District
    if (x === 0 && y === 5) {
      return Location.OFFICE_DISTRICT;
    }
    
    // Shopping Mall
    if (x === 1 && y === 5) {
      return Location.SHOPPING_MALL;
    }
    
    // City Park
    if (x === 2 && y === 5) {
      return Location.CITY_PARK;
    }
    
    // Construction Site
    if (x === 3 && y === 5) {
      return Location.CONSTRUCTION_SITE;
    }
    
    // Radio Tower
    if (x === 5 && y === 5) {
      return Location.RADIO_TOWER;
    }
    
    // Hospital
    if (x === 0 && y === 6) {
      return Location.HOSPITAL;
    }
    
    // Hotel
    if (x === 1 && y === 6) {
      return Location.HOTEL;
    }
    
    // Amusement Park
    if (x === 2 && y === 6) {
      return Location.AMUSEMENT_PARK;
    }
    
    // Camp Grounds
    if (x === 5 && y === 3) {
      return Location.CAMP_GROUNDS;
    }
    
    // Lake Side
    if ((x === 5 && y === 0) || (x === 6 && y === 0) || (x === 5 && y === 1) || (x === 6 && y === 1)) {
      return Location.LAKE_SIDE;
    }

    // Border tiles that aren't special locations are greater waste
    if (x === 0 || x === this.MAP_SIZE - 1 || y === 0 || y === this.MAP_SIZE - 1) {
      return Location.GREATER_WASTE;
    }

    // Inner tiles are waste
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
      case Direction.NORTHEAST:
        newX = currentX + 1;
        newY = currentY - 1;
        break;
      case Direction.EAST:
        newX = currentX + 1;
        break;
      case Direction.SOUTHEAST:
        newX = currentX + 1;
        newY = currentY + 1;
        break;
      case Direction.SOUTH:
        newY = currentY + 1;
        break;
      case Direction.SOUTHWEST:
        newX = currentX - 1;
        newY = currentY + 1;
        break;
      case Direction.WEST:
        newX = currentX - 1;
        break;
      case Direction.NORTHWEST:
        newX = currentX - 1;
        newY = currentY - 1;
        break;
    }

    return { x: newX, y: newY };
  }

  // Check if coordinates are valid (within map bounds)
  isValidCoordinate(x: number, y: number): boolean {
    return x >= 0 && x < this.MAP_SIZE && y >= 0 && y < this.MAP_SIZE;
  }

  // Get gate coordinates
  getGateCoordinates(): GridCoordinate {
    return { x: this.CENTER_X, y: this.CENTER_Y };
  }

  // Get directional name for display
  getDirectionDisplayName(direction: Direction): string {
    const names = {
      [Direction.NORTH]: 'North',
      [Direction.NORTHEAST]: 'Northeast',
      [Direction.EAST]: 'East',
      [Direction.SOUTHEAST]: 'Southeast',
      [Direction.SOUTH]: 'South',
      [Direction.SOUTHWEST]: 'Southwest',
      [Direction.WEST]: 'West',
      [Direction.NORTHWEST]: 'Northwest'
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
      case Location.GREATER_WASTE:
        return { name: 'Greater Waste', emoji: '🌲' };
      case Location.CITY:
        return { name: 'City', emoji: '🏠' };
      case Location.HOME:
        return { name: 'Home', emoji: '🏡' };
      case Location.FACTORY:
        return { name: 'Factory', emoji: '🏭' };
      case Location.ABANDONED_MANSION:
        return { name: 'Abandoned Mansion', emoji: '🏚️' };
      case Location.MODEST_NEIGHBORHOOD:
        return { name: 'Modest Neighborhood', emoji: '🏠' };
      case Location.GATED_COMMUNITY:
        return { name: 'Gated Community', emoji: '🏡' };
      case Location.CONVENIENCE_STORE:
        return { name: 'Convenience Store Street', emoji: '🏪' };
      case Location.OFFICE_DISTRICT:
        return { name: 'Office District', emoji: '🏢' };
      case Location.HOSPITAL:
        return { name: 'Hospital', emoji: '🏥' };
      case Location.SCHOOL_CAMPUS:
        return { name: 'School Campus', emoji: '🏫' };
      case Location.SHOPPING_MALL:
        return { name: 'Shopping Mall', emoji: '🏬' };
      case Location.HOTEL:
        return { name: 'Hotel', emoji: '🏨' };
      case Location.CITY_PARK:
        return { name: 'City Park', emoji: '⛲' };
      case Location.AMUSEMENT_PARK:
        return { name: 'Amusement Park', emoji: '🎡' };
      case Location.CONSTRUCTION_SITE:
        return { name: 'Construction Site', emoji: '🏗️' };
      case Location.RADIO_TOWER:
        return { name: 'Radio Tower', emoji: '🗼' };
      case Location.CAMP_GROUNDS:
        return { name: 'Camp Grounds', emoji: '🏕️' };
      case Location.LAKE_SIDE:
        return { name: 'Lake Side', emoji: '💧' };
      default:
        return { name: 'Unknown', emoji: '❓' };
    }
  }

  // Generate a composite image representation of the full map
  async generateMapView(playerService?: any): Promise<Buffer> {
    const canvasWidth = this.MAP_SIZE * this.TILE_SIZE;
    const canvasHeight = this.MAP_SIZE * this.TILE_SIZE;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Show the full 7x7 map
    for (let y = 0; y < this.MAP_SIZE; y++) {
      for (let x = 0; x < this.MAP_SIZE; x++) {
        // Check if any players are at this coordinate
        let hasPlayer = false;
        if (playerService) {
          try {
            const playersAtLocation = await playerService.getPlayersByCoordinates(x, y);
            hasPlayer = playersAtLocation.length > 0;
          } catch (error) {
            // If playerService fails, continue without player markers
            console.warn('Failed to check players at coordinates:', error);
          }
        }
        
        const location = this.getLocationAtCoordinate(x, y);
        const tileFilename = this.LOCATION_TILES[location];
        const tilePath = path.join(this.TILES_DIR, tileFilename);
        
        try {
          // Load and draw the base tile
          const tileImage = await loadImage(tilePath);
          const destX = x * this.TILE_SIZE;
          const destY = y * this.TILE_SIZE;
          ctx.drawImage(tileImage, destX, destY, this.TILE_SIZE, this.TILE_SIZE);
          
          // If there's a player here, overlay the player tile
          if (hasPlayer) {
            const playerTilePath = path.join(this.TILES_DIR, this.PLAYER_TILE);
            const playerImage = await loadImage(playerTilePath);
            ctx.drawImage(playerImage, destX, destY, this.TILE_SIZE, this.TILE_SIZE);
          }
        } catch (error) {
          console.error(`Failed to load tile ${tileFilename}:`, error);
          // Draw a red square as fallback
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(x * this.TILE_SIZE, y * this.TILE_SIZE, this.TILE_SIZE, this.TILE_SIZE);
        }
      }
    }

    return canvas.toBuffer('image/png');
  }
}