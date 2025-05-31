import { WorldMapService, TileState } from '../services/worldMap';
import { Location } from '../types/game';

describe('New Map System', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
    // Reset map state for each test
    worldMapService.resetMap();
  });

  test('should have 13x13 grid size', () => {
    // Test bounds checking
    expect(worldMapService.isValidCoordinate(0, 0)).toBe(true);
    expect(worldMapService.isValidCoordinate(12, 12)).toBe(true);
    expect(worldMapService.isValidCoordinate(13, 13)).toBe(false);
    expect(worldMapService.isValidCoordinate(-1, -1)).toBe(false);
  });

  test('should have center at (6,6) as GATE/TOWN', () => {
    const gateCoords = worldMapService.getGateCoordinates();
    expect(gateCoords.x).toBe(6);
    expect(gateCoords.y).toBe(6);
    
    const location = worldMapService.getLocationAtCoordinate(6, 6);
    expect(location).toBe(Location.GATE);
    
    const tileState = worldMapService.getTileState(6, 6);
    expect(tileState).toBe(TileState.TOWN);
  });

  test('should have 8 surrounding tiles as explored initially', () => {
    const surroundingCoords = [
      [5, 5], [5, 6], [5, 7],
      [6, 5],         [6, 7],
      [7, 5], [7, 6], [7, 7]
    ];
    
    surroundingCoords.forEach(([x, y]) => {
      const tileState = worldMapService.getTileState(x, y);
      expect(tileState).toBe(TileState.EXPLORED);
    });
  });

  test('should have most tiles as hidden initially', () => {
    // Test a random tile far from center
    const tileState = worldMapService.getTileState(0, 0);
    expect(tileState).toBe(TileState.HIDDEN);
    
    // Test another random tile
    const tileState2 = worldMapService.getTileState(12, 12);
    expect(tileState2).toBe(TileState.HIDDEN);
  });

  test('should mark tiles as explored when discovered', () => {
    // Initially hidden
    expect(worldMapService.getTileState(0, 0)).toBe(TileState.HIDDEN);
    
    // Mark as explored
    worldMapService.markTileExplored(0, 0);
    
    // Should now be explored
    expect(worldMapService.getTileState(0, 0)).toBe(TileState.EXPLORED);
  });

  test('should generate POI locations during initialization', () => {
    // Just verify the system works without errors
    // POI locations are internal and randomly generated
    expect(() => worldMapService.resetMap()).not.toThrow();
  });

  test('should generate map image with new 16x16 tile size', async () => {
    const mockPlayerService = {
      getPlayersByCoordinates: jest.fn().mockResolvedValue([])
    };
    
    const mapBuffer = await worldMapService.generateMapView(mockPlayerService);
    
    // Should return a valid PNG buffer
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
    
    // Verify PNG signature
    expect(mapBuffer[0]).toBe(0x89);
    expect(mapBuffer[1]).toBe(0x50);
    expect(mapBuffer[2]).toBe(0x4E);
    expect(mapBuffer[3]).toBe(0x47);
  });
});