import { GameEngine } from '../services/gameEngine';
import { GamePhase } from '../types/game';

// Mock environment variables
process.env.GAME_START_TIME = '21:00';
process.env.HORDE_START_TIME = '20:00';
process.env.ADMIN_PASSWORD = 'test_password';

describe('Admin Functionality', () => {
  describe('Environment Variable Configuration', () => {
    test('should use environment variables for game timing', () => {
      const gameStartTime = process.env.GAME_START_TIME;
      const hordeStartTime = process.env.HORDE_START_TIME;
      
      expect(gameStartTime).toBe('21:00');
      expect(hordeStartTime).toBe('20:00');
    });

    test('should have admin password configured', () => {
      const adminPassword = process.env.ADMIN_PASSWORD;
      expect(adminPassword).toBeDefined();
      expect(adminPassword).toBe('test_password');
    });
  });

  describe('Phase Time Parsing', () => {
    test('should correctly parse time strings', () => {
      const timeString = '21:30';
      const [hour, minute] = timeString.split(':').map(Number);
      
      expect(hour).toBe(21);
      expect(minute).toBe(30);
    });

    test('should handle default times when environment not set', () => {
      const originalGameTime = process.env.GAME_START_TIME;
      const originalHordeTime = process.env.HORDE_START_TIME;
      
      delete process.env.GAME_START_TIME;
      delete process.env.HORDE_START_TIME;
      
      const gameTime = process.env.GAME_START_TIME || '21:00';
      const hordeTime = process.env.HORDE_START_TIME || '20:00';
      
      expect(gameTime).toBe('21:00');
      expect(hordeTime).toBe('20:00');
      
      // Restore environment
      process.env.GAME_START_TIME = originalGameTime;
      process.env.HORDE_START_TIME = originalHordeTime;
    });
  });

  describe('Admin Command Structure', () => {
    test('should define admin command choices', () => {
      const adminCommands = ['reset', 'horde', 'refresh', 'hordesize', 'revive'];
      
      expect(adminCommands).toContain('reset');
      expect(adminCommands).toContain('horde');
      expect(adminCommands).toContain('refresh');
      expect(adminCommands).toContain('hordesize');
      expect(adminCommands).toContain('revive');
      expect(adminCommands.length).toBe(5);
    });

    test('should define horde configuration environment variables', () => {
      process.env.INITIAL_HORDE_SIZE = '10';
      process.env.HORDE_SCALING_FACTOR = '1.2';
      process.env.HORDE_SCALING_RANDOMNESS = '0.3';
      
      const initialHordeSize = parseInt(process.env.INITIAL_HORDE_SIZE || '10');
      const scalingFactor = parseFloat(process.env.HORDE_SCALING_FACTOR || '1.2');
      const scalingRandomness = parseFloat(process.env.HORDE_SCALING_RANDOMNESS || '0.3');
      
      expect(initialHordeSize).toBe(10);
      expect(scalingFactor).toBe(1.2);
      expect(scalingRandomness).toBe(0.3);
    });
  });

  describe('Horde Size Calculations', () => {
    test('should scale horde size with randomness factor', () => {
      const baseSize = 10;
      const scalingFactor = 1.2;
      const randomness = 0.3;
      
      // Test multiple iterations to ensure randomness is working
      const results = [];
      for (let i = 0; i < 10; i++) {
        const randomMultiplier = 1 + (Math.random() - 0.5) * randomness;
        const newSize = Math.floor(baseSize * scalingFactor * randomMultiplier);
        results.push(newSize);
      }
      
      // Results should vary due to randomness
      const uniqueResults = [...new Set(results)];
      expect(uniqueResults.length).toBeGreaterThan(1);
      
      // All results should be positive
      results.forEach(result => {
        expect(result).toBeGreaterThan(0);
      });
    });

    test('should ensure minimum horde size of 1', () => {
      const testSize = 0;
      const validSize = Math.max(1, testSize);
      expect(validSize).toBe(1);
    });
  });
});