import { DatabaseService } from '../services/database';

// Test for database wipe functionality
describe('Database Wipe Admin Command', () => {
  let mockPool: any;
  let mockClient: any;
  let databaseService: DatabaseService;

  beforeEach(() => {
    // Mock the database client and pool
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn(() => Promise.resolve(mockClient))
    };

    // Mock the DatabaseService
    databaseService = DatabaseService.getInstance();
    databaseService.pool = mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('wipeAllData', () => {
    test('should successfully wipe all database tables in correct order', async () => {
      // Setup successful transaction
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      const result = await databaseService.wipeAllData();

      expect(result).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      
      // Verify tables are deleted in correct order (respecting foreign keys)
      const deleteQueries = mockClient.query.mock.calls
        .filter(call => call[0].startsWith('DELETE FROM'))
        .map(call => call[0]);
      
      expect(deleteQueries).toEqual([
        'DELETE FROM area_inventories',
        'DELETE FROM explored_tiles',
        'DELETE FROM zombies',
        'DELETE FROM zone_contests',
        'DELETE FROM inventory',
        'DELETE FROM bank_inventories',
        'DELETE FROM buildings',
        'DELETE FROM players',
        'DELETE FROM items',
        'DELETE FROM cities'
      ]);

      // Verify default city is recreated
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cities')
      );

      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should rollback transaction on error', async () => {
      // Setup transaction that fails on one of the delete operations
      mockClient.query
        .mockResolvedValueOnce({ rowCount: 1 }) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE area_inventories
        .mockResolvedValueOnce({ rowCount: 1 }) // DELETE explored_tiles
        .mockRejectedValueOnce(new Error('Delete failed')); // DELETE zombies fails

      const result = await databaseService.wipeAllData();

      expect(result).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should handle connection errors gracefully', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      const result = await databaseService.wipeAllData();

      expect(result).toBe(false);
    });

    test('should recreate default city with correct values', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await databaseService.wipeAllData();

      // Find the INSERT query for cities
      const insertCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO cities')
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('Sanctuary');
      expect(insertCall[0]).toContain('play_mode');
      expect(insertCall[0]).toContain('true'); // gate_open = true
    });
  });
});