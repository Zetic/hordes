import { PlayerService } from '../models/player';
import { PlayerStatus, Location } from '../types/game';

// Mock database client for transaction testing
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(() => Promise.resolve(mockClient))
};

const mockDB = {
  pool: mockPool
};

// Mock the DatabaseService
jest.mock('../services/database', () => ({
  DatabaseService: {
    getInstance: () => mockDB
  }
}));

describe('PlayerService Reset Functionality', () => {
  let playerService: PlayerService;

  beforeEach(() => {
    jest.clearAllMocks();
    playerService = new PlayerService();
    
    // Setup successful transaction by default
    mockClient.query.mockResolvedValue({ rowCount: 1 });
  });

  describe('resetAllPlayers', () => {
    test('should clear inventories and reset player data in transaction', async () => {
      const result = await playerService.resetAllPlayers();
      
      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      
      // Should clear inventories first
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM inventory');
      
      // Should reset players with cleared coordinates
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE players'),
        [PlayerStatus.ALIVE, Location.CITY]
      );
      
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 5 }) // DELETE inventory
        .mockRejectedValueOnce(new Error('Update failed')); // UPDATE players fails
      
      const result = await playerService.resetAllPlayers();
      
      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should handle connection errors gracefully', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));
      
      const result = await playerService.resetAllPlayers();
      
      expect(result).toBe(false);
    });

    test('should ensure coordinates are cleared in reset query', async () => {
      await playerService.resetAllPlayers();
      
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE players')
      );
      
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('x = NULL');
      expect(updateCall[0]).toContain('y = NULL');
    });

    test('should set correct player status and location', async () => {
      await playerService.resetAllPlayers();
      
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE players')
      );
      
      expect(updateCall).toBeDefined();
      expect(updateCall[1]).toEqual([PlayerStatus.ALIVE, Location.CITY]);
    });

    test('should reset health and action points to max values', async () => {
      await playerService.resetAllPlayers();
      
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE players')
      );
      
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('health = max_health');
      expect(updateCall[0]).toContain('action_points = max_action_points');
    });

    test('should set players to alive status', async () => {
      await playerService.resetAllPlayers();
      
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE players')
      );
      
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('is_alive = true');
    });

    test('should reset water to default value', async () => {
      await playerService.resetAllPlayers();
      
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE players')
      );
      
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain('water = 10');
    });
  });
});