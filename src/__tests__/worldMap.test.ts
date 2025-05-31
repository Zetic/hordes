import { WorldMapService } from '../services/worldMap';
import { Location, Direction } from '../types/game';

describe('WorldMapService', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
    // Reset map for consistent testing
    worldMapService.resetMap();
  });

  test('should be a singleton', () => {
    const instance1 = WorldMapService.getInstance();
    const instance2 = WorldMapService.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should have gate at center (6,6) in new 13x13 system', () => {
    const gateCoords = worldMapService.getGateCoordinates();
    expect(gateCoords.x).toBe(6);
    expect(gateCoords.y).toBe(6);
    
    const location = worldMapService.getLocationAtCoordinate(6, 6);
    expect(location).toBe(Location.GATE);
  });

  test('should have waste in non-POI areas', () => {
    // Test coordinates that we know should be waste (avoid center and immediate surrounding)
    // Since POI locations are randomly generated, we'll test a larger number of coordinates
    // and expect most of them to be waste (since only 7 out of 169 total are POI)
    
    let wasteCount = 0;
    let totalTested = 0;
    
    // Test coordinates avoiding the center town area
    for (let x = 0; x < 13; x++) {
      for (let y = 0; y < 13; y++) {
        // Skip center town and its immediate surroundings (already explored)
        if (Math.abs(x - 6) <= 1 && Math.abs(y - 6) <= 1) {
          continue;
        }
        
        totalTested++;
        const location = worldMapService.getLocationAtCoordinate(x, y);
        if (location === Location.WASTE) {
          wasteCount++;
        }
      }
    }
    
    // Most coordinates should be waste (we expect 7 POI locations out of 160 tested)
    // So at least 150+ should be waste
    expect(wasteCount).toBeGreaterThan(150);
    expect(totalTested).toBe(160); // 13x13 - 9 center area = 169 - 9 = 160
  });

  test('should have POI locations randomly distributed', () => {
    // In the new system, POI locations are randomly generated
    // We can't predict exact coordinates, but we can verify the system works
    let foundPOIs = 0;
    
    // Check all coordinates for POI locations
    for (let x = 0; x < 13; x++) {
      for (let y = 0; y < 13; y++) {
        if (x === 6 && y === 6) continue; // Skip center (town)
        
        const location = worldMapService.getLocationAtCoordinate(x, y);
        if (location !== Location.WASTE && location !== Location.GATE) {
          foundPOIs++;
        }
      }
    }
    
    // Should have exactly 7 POI locations
    expect(foundPOIs).toBe(7);
  });

  test('should validate coordinates correctly for 13x13 grid', () => {
    // Valid coordinates
    expect(worldMapService.isValidCoordinate(0, 0)).toBe(true);
    expect(worldMapService.isValidCoordinate(12, 12)).toBe(true);
    expect(worldMapService.isValidCoordinate(6, 6)).toBe(true);

    // Invalid coordinates
    expect(worldMapService.isValidCoordinate(-1, 0)).toBe(false);
    expect(worldMapService.isValidCoordinate(13, 0)).toBe(false);
    expect(worldMapService.isValidCoordinate(0, -1)).toBe(false);
    expect(worldMapService.isValidCoordinate(0, 13)).toBe(false);
  });

  test('should calculate movement directions correctly', () => {
    const startX = 6;
    const startY = 6;

    // Test all 4 cardinal directions from center
    const north = worldMapService.getCoordinateInDirection(startX, startY, Direction.NORTH);
    expect(north).toEqual({ x: 6, y: 5 });

    const east = worldMapService.getCoordinateInDirection(startX, startY, Direction.EAST);
    expect(east).toEqual({ x: 7, y: 6 });

    const south = worldMapService.getCoordinateInDirection(startX, startY, Direction.SOUTH);
    expect(south).toEqual({ x: 6, y: 7 });

    const west = worldMapService.getCoordinateInDirection(startX, startY, Direction.WEST);
    expect(west).toEqual({ x: 5, y: 6 });
  });

  test('should provide proper location display names', () => {
    const gateDisplay = worldMapService.getLocationDisplay(Location.GATE);
    expect(gateDisplay.name).toBe('Gate');
    expect(gateDisplay.emoji).toBe('🚪');

    const wasteDisplay = worldMapService.getLocationDisplay(Location.WASTE);
    expect(wasteDisplay.name).toBe('Waste');
    expect(wasteDisplay.emoji).toBe('🌲');

    const greaterWasteDisplay = worldMapService.getLocationDisplay(Location.GREATER_WASTE);
    expect(greaterWasteDisplay.name).toBe('Greater Waste');
    expect(greaterWasteDisplay.emoji).toBe('🌲');
    
    // Test some of the POI locations
    const factoryDisplay = worldMapService.getLocationDisplay(Location.FACTORY);
    expect(factoryDisplay.name).toBe('Factory');
    expect(factoryDisplay.emoji).toBe('🏭');
    
    const hospitalDisplay = worldMapService.getLocationDisplay(Location.HOSPITAL);
    expect(hospitalDisplay.name).toBe('Hospital');
    expect(hospitalDisplay.emoji).toBe('🏥');
  });

  test('should generate map view as image buffer', async () => {
    // Test map view generation (should not throw)
    const mapBuffer = await worldMapService.generateMapView();
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
    // Should be a PNG image buffer (starts with PNG signature)
    expect(mapBuffer[0]).toBe(0x89); // PNG signature byte 1
    expect(mapBuffer[1]).toBe(0x50); // PNG signature byte 2 ('P')
    expect(mapBuffer[2]).toBe(0x4E); // PNG signature byte 3 ('N')
    expect(mapBuffer[3]).toBe(0x47); // PNG signature byte 4 ('G')
  });

  test('should throw error for out of bounds coordinates', () => {
    expect(() => {
      worldMapService.getLocationAtCoordinate(-1, 0);
    }).toThrow('Coordinates out of bounds');

    expect(() => {
      worldMapService.getLocationAtCoordinate(13, 0);
    }).toThrow('Coordinates out of bounds');
  });
});