import { DatabaseService } from '../services/database';

// Mock database pool for testing
const mockPool = {
  query: jest.fn()
};

const mockDB = {
  pool: mockPool,
  verifyItemsTableSchema: jest.fn(),
  isItemsSchemaValid: jest.fn()
};

// Mock the DatabaseService getInstance method
jest.mock('../services/database', () => ({
  DatabaseService: {
    getInstance: () => mockDB
  }
}));

describe('Database Schema Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Items Table Schema Verification', () => {
    test('should verify all required columns exist in items table', async () => {
      // Mock successful validation
      mockDB.verifyItemsTableSchema.mockResolvedValueOnce(undefined);

      const db = DatabaseService.getInstance();
      
      await (db as any).verifyItemsTableSchema();

      expect(mockDB.verifyItemsTableSchema).toHaveBeenCalled();
    });

    test('should return true when schema is valid', async () => {
      // Mock successful validation
      mockDB.isItemsSchemaValid.mockResolvedValueOnce(true);

      const db = DatabaseService.getInstance();
      
      const isValid = await db.isItemsSchemaValid();

      expect(isValid).toBe(true);
      expect(mockDB.isItemsSchemaValid).toHaveBeenCalled();
    });

    test('should return false when schema validation fails', async () => {
      // Mock failed validation
      mockDB.isItemsSchemaValid.mockResolvedValueOnce(false);

      const db = DatabaseService.getInstance();
      
      const isValid = await db.isItemsSchemaValid();

      expect(isValid).toBe(false);
      expect(mockDB.isItemsSchemaValid).toHaveBeenCalled();
    });
  });
});