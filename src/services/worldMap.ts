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

    // Border tiles are greater waste
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
          line += '👤'; // Any player position
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