import { ItemService } from '../models/item';
import { DatabaseService } from '../services/database';

// Create a test that ensures schema validation works correctly
describe('Item Creation Schema Integration', () => {
  test('should detect missing schema columns and handle gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock the database service to return false for schema validation
    const mockDB = {
      pool: {
        query: jest.fn()
      },
      isItemsSchemaValid: jest.fn().mockResolvedValue(false)
    };

    // Create ItemService with mocked database
    const itemService = new ItemService();
    (itemService as any).db = mockDB;

    // Attempt to initialize items - should fail due to invalid schema
    await itemService.initializeDefaultItems();

    // Verify that the error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error initializing default items:', 
      expect.objectContaining({
        message: 'Items table schema is not properly configured. Missing required columns.'
      })
    );

    consoleSpy.mockRestore();
  });

  test('should proceed with item creation when schema is valid', async () => {
    // Mock the database service to return true for schema validation
    const mockDB = {
      pool: {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // area_inventories delete
          .mockResolvedValueOnce({ rows: [] }) // inventory delete  
          .mockResolvedValueOnce({ rows: [] }) // bank_inventories delete
          .mockResolvedValueOnce({ rows: [] }) // items delete
          .mockResolvedValueOnce({ rows: [] }) // getItemByName - Box Cutter
          .mockResolvedValueOnce({ rows: [{ id: '1', name: 'Box Cutter' }] }) // createItem - Box Cutter
          .mockResolvedValueOnce({ rows: [] }) // getItemByName - Broken Box Cutter
          .mockResolvedValueOnce({ rows: [{ id: '2', name: 'Broken Box Cutter' }] }) // createItem - Broken Box Cutter
      },
      isItemsSchemaValid: jest.fn().mockResolvedValue(true)
    };

    // Create ItemService with mocked database
    const itemService = new ItemService();
    (itemService as any).db = mockDB;

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // Should succeed when schema is valid
    await itemService.initializeDefaultItems();

    // Verify successful completion
    expect(consoleSpy).toHaveBeenCalledWith('✅ Default items initialized');

    consoleSpy.mockRestore();
  });
});