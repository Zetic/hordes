import { Location, Direction, GridCoordinate, WorldMapTile } from '../types/game';

export class WorldMapService {
  private static instance: WorldMapService;
  
  // 7x7 grid with center at (3,3) = GATE
  private readonly MAP_SIZE = 7;
  private readonly CENTER_X = 3;
  private readonly CENTER_Y = 3;

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
        return { name: 'Gate', emoji: '<z_gate>' };
      case Location.WASTE:
        return { name: 'Waste', emoji: '<z_evergreen_tree>' };
      case Location.GREATER_WASTE:
        return { name: 'Greater Waste', emoji: '<z_evergreen_tree>' };
      case Location.CITY:
        return { name: 'City', emoji: '<z_house>' };
      case Location.HOME:
        return { name: 'Home', emoji: '<z_house_with_garden>' };
      case Location.FACTORY:
        return { name: 'Factory', emoji: '<z_factory>' };
      case Location.ABANDONED_MANSION:
        return { name: 'Abandoned Mansion', emoji: '<z_house_abandoned>' };
      case Location.MODEST_NEIGHBORHOOD:
        return { name: 'Modest Neighborhood', emoji: '<z_house>' };
      case Location.GATED_COMMUNITY:
        return { name: 'Gated Community', emoji: '<z_house_with_garden>' };
      case Location.CONVENIENCE_STORE:
        return { name: 'Convenience Store Street', emoji: '<z_convience_store>' };
      case Location.OFFICE_DISTRICT:
        return { name: 'Office District', emoji: '<z_office>' };
      case Location.HOSPITAL:
        return { name: 'Hospital', emoji: '<z_hospital>' };
      case Location.SCHOOL_CAMPUS:
        return { name: 'School Campus', emoji: '<z_school>' };
      case Location.SHOPPING_MALL:
        return { name: 'Shopping Mall', emoji: '<z_department_store>' };
      case Location.HOTEL:
        return { name: 'Hotel', emoji: '<z_hotel>' };
      case Location.CITY_PARK:
        return { name: 'City Park', emoji: '<z_fountain>' };
      case Location.AMUSEMENT_PARK:
        return { name: 'Amusement Park', emoji: '<z_ferris_wheel>' };
      case Location.CONSTRUCTION_SITE:
        return { name: 'Construction Site', emoji: '<z_construction_site>' };
      case Location.RADIO_TOWER:
        return { name: 'Radio Tower', emoji: '<z_tokyo_tower>' };
      case Location.CAMP_GROUNDS:
        return { name: 'Camp Grounds', emoji: '<z_campsite>' };
      case Location.LAKE_SIDE:
        return { name: 'Lake Side', emoji: '<z_pond>' };
      default:
        return { name: 'Unknown', emoji: '❓' };
    }
  }

  // Generate a visual representation of the full map
  async generateMapView(playerService?: any): Promise<string> {
    const mapLines: string[] = [];

    // Show the full 7x7 map
    for (let y = 0; y < this.MAP_SIZE; y++) {
      let line = '';
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
        
        if (hasPlayer) {
          line += '<z_player>'; // Any player position
        } else {
          const location = this.getLocationAtCoordinate(x, y);
          const display = this.getLocationDisplay(location);
          line += display.emoji;
        }
      }
      mapLines.push(line);
    }

    return mapLines.join('\n');
  }
}