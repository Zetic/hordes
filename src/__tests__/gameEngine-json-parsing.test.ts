import { safeJsonParse } from '../utils/jsonUtils';

// Mock GameEngine to test JSON parsing without full service dependencies
describe('GameEngine JSON Parsing Edge Cases', () => {
  describe('Game State JSON Parsing', () => {
    test('should handle valid game state JSON correctly', () => {
      const validGameState = '{"hordeSize": 15, "currentDay": 5}';
      const result = safeJsonParse(validGameState, { hordeSize: 10 }, 'game state from Redis');
      
      expect(result.success).toBe(true);
      expect((result.data as any).hordeSize).toBe(15);
      expect((result.data as any).currentDay).toBe(5);
      expect(result.error).toBeUndefined();
    });

    test('should use fallback for invalid game state JSON', () => {
      const invalidGameState = '{"hordeSize": 15, "currentDay": 5'; // Missing closing brace
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(invalidGameState, fallback, 'game state from Redis');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should handle null game state gracefully', () => {
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(null, fallback, 'game state from Redis');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should handle empty game state gracefully', () => {
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse('', fallback, 'game state from Redis');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should handle corrupted Redis data gracefully', () => {
      const corruptedData = 'some random text that is not JSON';
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(corruptedData, fallback, 'cached game state from Redis');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should handle partial JSON data gracefully', () => {
      const partialJson = '{"hordeSize": 15'; // Incomplete JSON
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(partialJson, fallback, 'game state from Redis');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should handle malformed JSON with extra characters', () => {
      const malformedJson = '{"hordeSize": 15}extra_chars';
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(malformedJson, fallback, 'game state from Redis');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should extract hordeSize correctly when present', () => {
      const gameStateWithHordeSize = '{"hordeSize": 25, "currentDay": 3, "other": "data"}';
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(gameStateWithHordeSize, fallback, 'game state from Redis');
      
      expect(result.success).toBe(true);
      expect((result.data as any).hordeSize).toBe(25);
      
      // Simulate the GameEngine logic for extracting hordeSize
      const extractedHordeSize = (result.data as any).hordeSize || fallback.hordeSize;
      expect(extractedHordeSize).toBe(25);
    });

    test('should use fallback hordeSize when not present in JSON', () => {
      const gameStateWithoutHordeSize = '{"currentDay": 3, "other": "data"}';
      const fallback = { hordeSize: 10 };
      const result = safeJsonParse(gameStateWithoutHordeSize, fallback, 'game state from Redis');
      
      expect(result.success).toBe(true);
      expect((result.data as any).hordeSize).toBeUndefined();
      
      // Simulate the GameEngine logic for extracting hordeSize
      const extractedHordeSize = (result.data as any).hordeSize || fallback.hordeSize;
      expect(extractedHordeSize).toBe(10);
    });
  });

  describe('JSON Parsing Error Logging', () => {
    test('should log appropriate context information', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const invalidJson = 'invalid{json}';
      safeJsonParse(invalidJson, {}, 'test context for logging');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse JSON (test context for logging)'),
        expect.any(String)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Raw JSON string:',
        invalidJson
      );
      
      consoleSpy.mockRestore();
    });
  });
});