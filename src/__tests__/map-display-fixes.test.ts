import { WorldMapService } from '../services/worldMap';
import { PlayerService } from '../models/player';

describe('Map Display Fixes', () => {
  let worldMapService: WorldMapService;
  let mockPlayerService: any;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
    
    // Create a mock player service that doesn't require database
    mockPlayerService = {
      getPlayersByCoordinates: jest.fn().mockResolvedValue([])
    };
  });

  test('should generate full 7x7 map instead of 5x5 view', async () => {
    const mapView = await worldMapService.generateMapView(mockPlayerService);
    
    // Count number of lines - should be 7 for a 7x7 map
    const lines = mapView.split('\n');
    expect(lines.length).toBe(7);
    
    // Each line should have 7 emojis (14 characters since emojis are 2 chars each)
    lines.forEach(line => {
      expect(line.length).toBe(14); // 7 emojis * 2 chars each
    });
  });

  test('should not contain out-of-bounds markers (⬛)', async () => {
    const mapView = await worldMapService.generateMapView(mockPlayerService);
    
    // Should not contain any ⬛ since we show the full map
    expect(mapView).not.toContain('⬛');
  });

  test('should show player marker when players are present', async () => {
    // Mock player service to return a player at coordinates (3,3)
    mockPlayerService.getPlayersByCoordinates = jest.fn()
      .mockImplementation(async (x: number, y: number) => {
        if (x === 3 && y === 3) {
          return [{ id: 1, name: 'TestPlayer', x: 3, y: 3 }];
        }
        return [];
      });

    const mapView = await worldMapService.generateMapView(mockPlayerService);
    
    // Should contain player marker
    expect(mapView).toContain('👤');
  });

  test('should show location emojis when no players are present', async () => {
    const mapView = await worldMapService.generateMapView(mockPlayerService);
    
    // Should contain gate emoji at center (3,3)
    const lines = mapView.split('\n');
    // The gate emoji should be at line 3, positions 6-7 (0-indexed, 3rd emoji = chars 6-7)
    expect(lines[3].substring(6, 8)).toBe('🚪'); // Gate emoji at center
    
    // Should contain waste emojis in inner areas
    expect(mapView).toContain('🌲');
  });

  test('should work without player service parameter', async () => {
    const mapView = await worldMapService.generateMapView();
    
    // Should generate map without errors
    expect(typeof mapView).toBe('string');
    expect(mapView.length).toBeGreaterThan(0);
    
    // Should not contain player markers when no service provided
    expect(mapView).not.toContain('👤');
  });

  test('should handle player service errors gracefully', async () => {
    // Mock player service that throws errors
    const errorPlayerService = {
      getPlayersByCoordinates: jest.fn().mockRejectedValue(new Error('Database error'))
    };

    const mapView = await worldMapService.generateMapView(errorPlayerService);
    
    // Should still generate map without player markers
    expect(typeof mapView).toBe('string');
    expect(mapView.length).toBeGreaterThan(0);
    expect(mapView).not.toContain('👤');
  });

  test('should maintain proper map structure', async () => {
    const mapView = await worldMapService.generateMapView(mockPlayerService);
    
    // Split into lines and verify structure
    const lines = mapView.split('\n');
    
    // Should be exactly 7 lines
    expect(lines.length).toBe(7);
    
    // First and last lines should contain greater waste (border)
    expect(lines[0]).toMatch(/🌲/);
    expect(lines[6]).toMatch(/🌲/);
    
    // Center line should contain gate at position 3 (chars 6-7)
    expect(lines[3].substring(6, 8)).toBe('🚪');
  });
});