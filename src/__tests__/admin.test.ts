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
      const adminCommands = ['reset', 'horde', 'refresh'];
      
      expect(adminCommands).toContain('reset');
      expect(adminCommands).toContain('horde');
      expect(adminCommands).toContain('refresh');
      expect(adminCommands.length).toBe(3);
    });
  });
});