// Integration test to verify the complete move flow works correctly with coordinate 0
import { WorldMapService } from '../services/worldMap';
import { Direction, Location } from '../types/game';

describe('Move Command Integration with Coordinate Zero', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
  });

  test('should correctly calculate movement from (1, 3) to (0, 3) via west direction', () => {
    // This is the exact scenario mentioned in the issue
    const currentX = 1;
    const currentY = 3;
    const direction = Direction.WEST;

    // Calculate new coordinates
    const newCoords = worldMapService.getCoordinateInDirection(currentX, currentY, direction);
    
    // Verify the new coordinates
    expect(newCoords.x).toBe(0);
    expect(newCoords.y).toBe(3);

    // Verify the coordinates are valid
    expect(worldMapService.isValidCoordinate(newCoords.x, newCoords.y)).toBe(true);

    // Verify the location type is correct (border should be GREATER_WASTE)
    const newLocation = worldMapService.getLocationAtCoordinate(newCoords.x, newCoords.y);
    expect(newLocation).toBe(Location.GREATER_WASTE);
  });

  test('should correctly handle all directions leading to coordinate 0', () => {
    // Test moving to coordinates with x=0
    const westFromWaste = worldMapService.getCoordinateInDirection(1, 2, Direction.WEST);
    expect(westFromWaste).toEqual({ x: 0, y: 2 });
    expect(worldMapService.isValidCoordinate(westFromWaste.x, westFromWaste.y)).toBe(true);

    // Test moving to coordinates with y=0
    const northFromWaste = worldMapService.getCoordinateInDirection(2, 1, Direction.NORTH);
    expect(northFromWaste).toEqual({ x: 2, y: 0 });
    expect(worldMapService.isValidCoordinate(northFromWaste.x, northFromWaste.y)).toBe(true);

    // Test moving to corner (0, 0)
    const northwestFromWaste = worldMapService.getCoordinateInDirection(1, 1, Direction.NORTHWEST);
    expect(northwestFromWaste).toEqual({ x: 0, y: 0 });
    expect(worldMapService.isValidCoordinate(northwestFromWaste.x, northwestFromWaste.y)).toBe(true);
  });

  test('should correctly identify all border coordinates as GREATER_WASTE', () => {
    // Test all border coordinates (edges of the 7x7 grid)
    const borderCoordinates = [
      { x: 0, y: 0 }, { x: 0, y: 3 }, { x: 0, y: 6 },  // Left edge
      { x: 6, y: 0 }, { x: 6, y: 3 }, { x: 6, y: 6 },  // Right edge
      { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 },  // Top edge
      { x: 3, y: 6 }, { x: 1, y: 6 }, { x: 5, y: 6 }   // Bottom edge
    ];

    borderCoordinates.forEach(coord => {
      const location = worldMapService.getLocationAtCoordinate(coord.x, coord.y);
      expect(location).toBe(Location.GREATER_WASTE);
    });
  });

  test('should handle map boundaries correctly', () => {
    // Verify map size constraints
    expect(worldMapService.isValidCoordinate(0, 0)).toBe(true);    // Top-left corner
    expect(worldMapService.isValidCoordinate(6, 6)).toBe(true);    // Bottom-right corner
    expect(worldMapService.isValidCoordinate(-1, 0)).toBe(false);  // Beyond left edge
    expect(worldMapService.isValidCoordinate(0, -1)).toBe(false);  // Beyond top edge
    expect(worldMapService.isValidCoordinate(7, 0)).toBe(false);   // Beyond right edge
    expect(worldMapService.isValidCoordinate(0, 7)).toBe(false);   // Beyond bottom edge
  });
});