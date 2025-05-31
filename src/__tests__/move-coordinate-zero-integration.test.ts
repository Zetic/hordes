// Integration test to verify the complete move flow works correctly with coordinate 0
import { WorldMapService } from '../services/worldMap';
import { Direction, Location } from '../types/game';

describe('Move Command Integration with Coordinate Zero', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
    // Reset map for consistent testing
    worldMapService.resetMap();
  });

  test('should correctly calculate movement from (7, 6) to (6, 6) via west direction', () => {
    // Test movement to the town center in the new 13x13 system
    const currentX = 7;
    const currentY = 6;
    const direction = Direction.WEST;

    // Calculate new coordinates
    const newCoords = worldMapService.getCoordinateInDirection(currentX, currentY, direction);
    
    // Verify the new coordinates
    expect(newCoords.x).toBe(6);
    expect(newCoords.y).toBe(6);

    // Verify the coordinates are valid
    expect(worldMapService.isValidCoordinate(newCoords.x, newCoords.y)).toBe(true);

    // Verify the location type is correct (center should be GATE)
    const newLocation = worldMapService.getLocationAtCoordinate(newCoords.x, newCoords.y);
    expect(newLocation).toBe(Location.GATE);
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

  test('should correctly identify non-special coordinates as WASTE in new system', () => {
    // Test various coordinates that should be WASTE (non-POI, non-town)
    // Since POI locations are randomly generated, we'll test enough coordinates
    // to verify that most are WASTE (only 7 out of 169 should be POI)
    
    const testCoordinates = [
      { x: 0, y: 0 }, { x: 0, y: 3 }, { x: 0, y: 12 },  // Left edge
      { x: 12, y: 0 }, { x: 12, y: 3 }, { x: 12, y: 12 },  // Right edge
      { x: 3, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 0 },  // Top edge
      { x: 3, y: 12 }, { x: 1, y: 12 }, { x: 5, y: 12 }   // Bottom edge
    ];

    let wasteCount = 0;
    testCoordinates.forEach(coord => {
      const location = worldMapService.getLocationAtCoordinate(coord.x, coord.y);
      // In the new system, non-POI locations default to WASTE
      if (location === Location.WASTE) {
        wasteCount++;
      }
    });
    
    // Most of these coordinates should be WASTE (expect at least 9 out of 12)
    expect(wasteCount).toBeGreaterThanOrEqual(9);
  });

  test('should handle map boundaries correctly for 13x13 grid', () => {
    // Verify map size constraints for new 13x13 grid
    expect(worldMapService.isValidCoordinate(0, 0)).toBe(true);     // Top-left corner
    expect(worldMapService.isValidCoordinate(12, 12)).toBe(true);   // Bottom-right corner
    expect(worldMapService.isValidCoordinate(6, 6)).toBe(true);     // Center (town)
    expect(worldMapService.isValidCoordinate(-1, 0)).toBe(false);   // Beyond left edge
    expect(worldMapService.isValidCoordinate(0, -1)).toBe(false);   // Beyond top edge
    expect(worldMapService.isValidCoordinate(13, 0)).toBe(false);   // Beyond right edge
    expect(worldMapService.isValidCoordinate(0, 13)).toBe(false);   // Beyond bottom edge
  });
});