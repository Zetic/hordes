// Test to reproduce and verify the fix for the invalid position error
// when moving to coordinates with 0 values (like (0, 3) or (1, 0))

import { PlayerService } from '../models/player';
import { Location } from '../types/game';

describe('Coordinate Zero Fix', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    playerService = new PlayerService();
  });

  test('should handle coordinate (0, 3) correctly without setting x to null', async () => {
    // Mock the database query to verify the parameters passed
    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
    playerService['db'] = {
      pool: { query: mockQuery }
    } as any;

    // Test updatePlayerLocation with x=0
    await playerService.updatePlayerLocation('test-user', Location.GREATER_WASTE, 0, 3);

    // Verify that x=0 is passed as 0, not null
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.GREATER_WASTE, 0, 3, 'test-user']
    );
  });

  test('should handle coordinate (1, 0) correctly without setting y to null', async () => {
    // Mock the database query to verify the parameters passed
    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
    playerService['db'] = {
      pool: { query: mockQuery }
    } as any;

    // Test updatePlayerLocation with y=0
    await playerService.updatePlayerLocation('test-user', Location.GREATER_WASTE, 1, 0);

    // Verify that y=0 is passed as 0, not null
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.GREATER_WASTE, 1, 0, 'test-user']
    );
  });

  test('should handle coordinate (0, 0) correctly without setting either to null', async () => {
    // Mock the database query to verify the parameters passed
    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
    playerService['db'] = {
      pool: { query: mockQuery }
    } as any;

    // Test updatePlayerLocation with both x=0 and y=0
    await playerService.updatePlayerLocation('test-user', Location.GREATER_WASTE, 0, 0);

    // Verify that both x=0 and y=0 are passed as 0, not null
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.GREATER_WASTE, 0, 0, 'test-user']
    );
  });

  test('should still handle undefined coordinates by setting them to null', async () => {
    // Mock the database query to verify the parameters passed
    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
    playerService['db'] = {
      pool: { query: mockQuery }
    } as any;

    // Test updatePlayerLocation with undefined coordinates (for city/home locations)
    await playerService.updatePlayerLocation('test-user', Location.CITY, undefined, undefined);

    // Verify that undefined values are converted to null
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.CITY, null, null, 'test-user']
    );
  });

  test('should handle mixed coordinate scenarios', async () => {
    // Mock the database query to verify the parameters passed
    const mockQuery = jest.fn().mockResolvedValue({ rowCount: 1 });
    playerService['db'] = {
      pool: { query: mockQuery }
    } as any;

    // Test with x=0 and y=undefined
    await playerService.updatePlayerLocation('test-user', Location.CITY, 0, undefined);
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.CITY, 0, null, 'test-user']
    );

    // Test with x=undefined and y=0
    await playerService.updatePlayerLocation('test-user', Location.CITY, undefined, 0);
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE players'),
      [Location.CITY, null, 0, 'test-user']
    );
  });
});