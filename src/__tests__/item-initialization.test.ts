import { ItemService } from '../models/item';
import { DatabaseService } from '../services/database';

// Mock database client for testing
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(() => Promise.resolve(mockClient))
};

const mockDB = {
  pool: mockPool,
  isItemsSchemaValid: jest.fn().mockResolvedValue(true)
};

// Mock the DatabaseService
jest.mock('../services/database', () => ({
  DatabaseService: {
    getInstance: () => mockDB
  }
}));

describe('ItemService Foreign Key Constraint Fix', () => {
  let itemService: ItemService;

  beforeEach(() => {
    jest.clearAllMocks();
    itemService = new ItemService();
    
    // Setup default successful responses
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  describe('initializeDefaultItems', () => {
    test('should handle foreign key constraints by deleting dependent records first', async () => {
      // Simulate that no items exist after clearing (getItemByName returns null)
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM area_inventories
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM inventory  
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM bank_inventories
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM items
        .mockResolvedValueOnce({ rows: [] }) // getItemByName('Box Cutter')
        .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Box Cutter' }] }) // createItem response
        .mockResolvedValueOnce({ rows: [] }) // getItemByName('Broken Box Cutter')
        .mockResolvedValueOnce({ rows: [{ id: '2', name: 'Broken Box Cutter' }] }); // createItem response

      await itemService.initializeDefaultItems();

      // Verify the order of operations
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM area_inventories');
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM inventory');
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM bank_inventories');
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM items');

      // Verify dependent tables are cleared before items table
      const calls = mockPool.query.mock.calls;
      const areaInventoriesIndex = calls.findIndex(call => call[0] === 'DELETE FROM area_inventories');
      const inventoryIndex = calls.findIndex(call => call[0] === 'DELETE FROM inventory');
      const bankInventoriesIndex = calls.findIndex(call => call[0] === 'DELETE FROM bank_inventories');
      const itemsIndex = calls.findIndex(call => call[0] === 'DELETE FROM items');

      expect(areaInventoriesIndex).toBeLessThan(itemsIndex);
      expect(inventoryIndex).toBeLessThan(itemsIndex);
      expect(bankInventoriesIndex).toBeLessThan(itemsIndex);
    });

    test('should handle errors gracefully when DELETE fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Make the DELETE FROM items fail which should trigger the main error handler
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM area_inventories - success
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM inventory - success
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM bank_inventories - success
        .mockRejectedValueOnce(new Error('Foreign key constraint violation')); // DELETE FROM items - fails

      await itemService.initializeDefaultItems();

      expect(consoleSpy).toHaveBeenCalledWith('Error initializing default items:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    test('should still create items even if dependent table deletes fail', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // First DELETE fails, but the method continues
      mockPool.query
        .mockRejectedValueOnce(new Error('Table does not exist')) // area_inventories
        .mockResolvedValueOnce({ rows: [] }) // inventory
        .mockResolvedValueOnce({ rows: [] }) // bank_inventories  
        .mockResolvedValueOnce({ rows: [] }) // items
        .mockResolvedValueOnce({ rows: [] }) // getItemByName
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }); // createItem

      await itemService.initializeDefaultItems();

      // Should still try to delete items and create new ones
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM items');
      
      consoleSpy.mockRestore();
    });
  });
});