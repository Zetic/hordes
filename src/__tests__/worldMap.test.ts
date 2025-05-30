import { WorldMapService } from '../services/worldMap';
import { Location, Direction } from '../types/game';

describe('WorldMapService', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
  });

  test('should be a singleton', () => {
    const instance1 = WorldMapService.getInstance();
    const instance2 = WorldMapService.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should have gate at center (3,3)', () => {
    const gateCoords = worldMapService.getGateCoordinates();
    expect(gateCoords.x).toBe(3);
    expect(gateCoords.y).toBe(3);
    
    const location = worldMapService.getLocationAtCoordinate(3, 3);
    expect(location).toBe(Location.GATE);
  });

  test('should have waste in inner areas', () => {
    // Test some inner coordinates that are still waste
    expect(worldMapService.getLocationAtCoordinate(2, 2)).toBe(Location.WASTE);
    expect(worldMapService.getLocationAtCoordinate(4, 4)).toBe(Location.WASTE);
    expect(worldMapService.getLocationAtCoordinate(4, 2)).toBe(Location.WASTE);
    expect(worldMapService.getLocationAtCoordinate(2, 4)).toBe(Location.WASTE);
  });

  test('should have new location types at specific coordinates', () => {
    // Test new locations
    expect(worldMapService.getLocationAtCoordinate(0, 0)).toBe(Location.FACTORY);
    expect(worldMapService.getLocationAtCoordinate(3, 1)).toBe(Location.ABANDONED_MANSION);
    expect(worldMapService.getLocationAtCoordinate(0, 3)).toBe(Location.MODEST_NEIGHBORHOOD);
    expect(worldMapService.getLocationAtCoordinate(1, 3)).toBe(Location.CONVENIENCE_STORE);
    expect(worldMapService.getLocationAtCoordinate(5, 0)).toBe(Location.LAKE_SIDE);
  });

  test('should have greater waste on borders that are not special locations', () => {
    // Test border coordinates that should be greater waste
    expect(worldMapService.getLocationAtCoordinate(2, 0)).toBe(Location.GREATER_WASTE);
    expect(worldMapService.getLocationAtCoordinate(4, 0)).toBe(Location.GREATER_WASTE);
    expect(worldMapService.getLocationAtCoordinate(6, 3)).toBe(Location.GREATER_WASTE);
    expect(worldMapService.getLocationAtCoordinate(3, 6)).toBe(Location.GREATER_WASTE);
  });

  test('should validate coordinates correctly', () => {
    // Valid coordinates
    expect(worldMapService.isValidCoordinate(0, 0)).toBe(true);
    expect(worldMapService.isValidCoordinate(6, 6)).toBe(true);
    expect(worldMapService.isValidCoordinate(3, 3)).toBe(true);

    // Invalid coordinates
    expect(worldMapService.isValidCoordinate(-1, 0)).toBe(false);
    expect(worldMapService.isValidCoordinate(7, 0)).toBe(false);
    expect(worldMapService.isValidCoordinate(0, -1)).toBe(false);
    expect(worldMapService.isValidCoordinate(0, 7)).toBe(false);
  });

  test('should calculate movement directions correctly', () => {
    const startX = 3;
    const startY = 3;

    // Test all 8 directions
    const north = worldMapService.getCoordinateInDirection(startX, startY, Direction.NORTH);
    expect(north).toEqual({ x: 3, y: 2 });

    const northeast = worldMapService.getCoordinateInDirection(startX, startY, Direction.NORTHEAST);
    expect(northeast).toEqual({ x: 4, y: 2 });

    const east = worldMapService.getCoordinateInDirection(startX, startY, Direction.EAST);
    expect(east).toEqual({ x: 4, y: 3 });

    const southeast = worldMapService.getCoordinateInDirection(startX, startY, Direction.SOUTHEAST);
    expect(southeast).toEqual({ x: 4, y: 4 });

    const south = worldMapService.getCoordinateInDirection(startX, startY, Direction.SOUTH);
    expect(south).toEqual({ x: 3, y: 4 });

    const southwest = worldMapService.getCoordinateInDirection(startX, startY, Direction.SOUTHWEST);
    expect(southwest).toEqual({ x: 2, y: 4 });

    const west = worldMapService.getCoordinateInDirection(startX, startY, Direction.WEST);
    expect(west).toEqual({ x: 2, y: 3 });

    const northwest = worldMapService.getCoordinateInDirection(startX, startY, Direction.NORTHWEST);
    expect(northwest).toEqual({ x: 2, y: 2 });
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
    
    // Test some of the new locations
    const factoryDisplay = worldMapService.getLocationDisplay(Location.FACTORY);
    expect(factoryDisplay.name).toBe('Factory');
    expect(factoryDisplay.emoji).toBe('🏭');
    
    const hospitalDisplay = worldMapService.getLocationDisplay(Location.HOSPITAL);
    expect(hospitalDisplay.name).toBe('Hospital');
    expect(hospitalDisplay.emoji).toBe('🏥');
    
    const lakeSideDisplay = worldMapService.getLocationDisplay(Location.LAKE_SIDE);
    expect(lakeSideDisplay.name).toBe('Lake Side');
    expect(lakeSideDisplay.emoji).toBe('💧');
  });

  test('should generate map view', async () => {
    // Test map view generation (should not throw)
    const mapView = await worldMapService.generateMapView();
    expect(typeof mapView).toBe('string');
    expect(mapView.length).toBeGreaterThan(0);
    // Should contain location emojis
    expect(mapView).toMatch(/[🚪🌲]/); // Should contain gate or waste emojis
  });

  test('should throw error for out of bounds coordinates', () => {
    expect(() => {
      worldMapService.getLocationAtCoordinate(-1, 0);
    }).toThrow('Coordinates out of bounds');

    expect(() => {
      worldMapService.getLocationAtCoordinate(7, 0);
    }).toThrow('Coordinates out of bounds');
  });
});