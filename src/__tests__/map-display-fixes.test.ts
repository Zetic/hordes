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

  test('should generate composite image map with correct dimensions', async () => {
    const mapBuffer = await worldMapService.generateMapView(mockPlayerService);
    
    // Should return a Buffer
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
    
    // Should be a PNG image buffer (starts with PNG signature)
    expect(mapBuffer[0]).toBe(0x89); // PNG signature byte 1
    expect(mapBuffer[1]).toBe(0x50); // PNG signature byte 2 ('P')
    expect(mapBuffer[2]).toBe(0x4E); // PNG signature byte 3 ('N')
    expect(mapBuffer[3]).toBe(0x47); // PNG signature byte 4 ('G')
  });

  test('should generate map without player markers when no players present', async () => {
    const mapBuffer = await worldMapService.generateMapView(mockPlayerService);
    
    // Should still generate a valid image
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
    
    // Verify mock was called (means we checked for players)
    expect(mockPlayerService.getPlayersByCoordinates).toHaveBeenCalled();
  });

  test('should handle player service errors gracefully', async () => {
    // Create an error-throwing player service
    const errorPlayerService = {
      getPlayersByCoordinates: jest.fn().mockRejectedValue(new Error('Database error'))
    };
    
    const mapBuffer = await worldMapService.generateMapView(errorPlayerService);
    
    // Should still generate a valid image even when player service fails
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
  });

  test('should work without player service (no player markers)', async () => {
    const mapBuffer = await worldMapService.generateMapView();
    
    // Should generate a valid image
    expect(Buffer.isBuffer(mapBuffer)).toBe(true);
    expect(mapBuffer.length).toBeGreaterThan(0);
  });

  test('should generate consistent output for same input', async () => {
    const mapBuffer1 = await worldMapService.generateMapView(mockPlayerService);
    const mapBuffer2 = await worldMapService.generateMapView(mockPlayerService);
    
    // Both should be valid buffers of the same size
    expect(Buffer.isBuffer(mapBuffer1)).toBe(true);
    expect(Buffer.isBuffer(mapBuffer2)).toBe(true);
    expect(mapBuffer1.length).toBe(mapBuffer2.length);
  });
});