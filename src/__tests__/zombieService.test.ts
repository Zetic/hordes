import { ZombieService, ThreatLevel } from '../services/zombieService';

// Mock database for testing
const mockPool = {
  query: jest.fn()
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

describe('ZombieService', () => {
  let zombieService: ZombieService;

  beforeEach(() => {
    jest.clearAllMocks();
    zombieService = ZombieService.getInstance();
  });

  describe('getThreatLevel', () => {
    test('should return NONE for 0 zombies', () => {
      expect(zombieService.getThreatLevel(0)).toBe(ThreatLevel.NONE);
    });

    test('should return LOW for 1-2 zombies', () => {
      expect(zombieService.getThreatLevel(1)).toBe(ThreatLevel.LOW);
      expect(zombieService.getThreatLevel(2)).toBe(ThreatLevel.LOW);
    });

    test('should return MEDIUM for 3-4 zombies', () => {
      expect(zombieService.getThreatLevel(3)).toBe(ThreatLevel.MEDIUM);
      expect(zombieService.getThreatLevel(4)).toBe(ThreatLevel.MEDIUM);
    });

    test('should return HIGH for 5+ zombies', () => {
      expect(zombieService.getThreatLevel(5)).toBe(ThreatLevel.HIGH);
      expect(zombieService.getThreatLevel(10)).toBe(ThreatLevel.HIGH);
    });
  });

  describe('getZombiesAtLocation', () => {
    test('should return zombie data when found', async () => {
      const mockResult = {
        rows: [{ x: 5, y: 5, count: 3 }]
      };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await zombieService.getZombiesAtLocation(5, 5);
      
      expect(result).toEqual({ x: 5, y: 5, count: 3 });
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT x, y, count FROM zombies WHERE x = $1 AND y = $2',
        [5, 5]
      );
    });

    test('should return null when no zombies found', async () => {
      const mockResult = { rows: [] };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await zombieService.getZombiesAtLocation(5, 5);
      
      expect(result).toBeNull();
    });

    test('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await zombieService.getZombiesAtLocation(5, 5);
      
      expect(result).toBeNull();
    });
  });

  describe('setZombiesAtLocation', () => {
    test('should insert zombies when count > 0', async () => {
      mockPool.query.mockResolvedValue({});

      const result = await zombieService.setZombiesAtLocation(5, 5, 3);
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO zombies'),
        [5, 5, 3]
      );
    });

    test('should delete zombies when count <= 0', async () => {
      mockPool.query.mockResolvedValue({});

      const result = await zombieService.setZombiesAtLocation(5, 5, 0);
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM zombies WHERE x = $1 AND y = $2',
        [5, 5]
      );
    });

    test('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await zombieService.setZombiesAtLocation(5, 5, 3);
      
      expect(result).toBe(false);
    });
  });

  describe('addZombiesAtLocation', () => {
    test('should add to existing zombie count', async () => {
      // Mock getZombiesAtLocation to return existing zombies
      const getZombiesSpy = jest.spyOn(zombieService, 'getZombiesAtLocation')
        .mockResolvedValue({ x: 5, y: 5, count: 2 });
      
      const setZombiesSpy = jest.spyOn(zombieService, 'setZombiesAtLocation')
        .mockResolvedValue(true);

      const result = await zombieService.addZombiesAtLocation(5, 5, 3);
      
      expect(result).toBe(true);
      expect(getZombiesSpy).toHaveBeenCalledWith(5, 5);
      expect(setZombiesSpy).toHaveBeenCalledWith(5, 5, 5); // 2 + 3 = 5
    });

    test('should create new zombies when none exist', async () => {
      const getZombiesSpy = jest.spyOn(zombieService, 'getZombiesAtLocation')
        .mockResolvedValue(null);
      
      const setZombiesSpy = jest.spyOn(zombieService, 'setZombiesAtLocation')
        .mockResolvedValue(true);

      const result = await zombieService.addZombiesAtLocation(5, 5, 3);
      
      expect(result).toBe(true);
      expect(setZombiesSpy).toHaveBeenCalledWith(5, 5, 3); // 0 + 3 = 3
    });
  });

  describe('clearAllZombies', () => {
    test('should delete all zombies from database', async () => {
      mockPool.query.mockResolvedValue({});

      const result = await zombieService.clearAllZombies();
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM zombies');
    });

    test('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await zombieService.clearAllZombies();
      
      expect(result).toBe(false);
    });
  });
});