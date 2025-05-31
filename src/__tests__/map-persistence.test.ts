import { WorldMapService } from '../services/worldMap';

// Mock dependencies
const mockPool = {
  query: jest.fn()
};

const mockDB = {
  pool: mockPool
};

const mockZombieService = {
  getThreatLevelAtLocation: jest.fn(),
  clearAllZombies: jest.fn(),
  initializeWorldZombies: jest.fn()
};

// Mock the services
jest.mock('../services/database', () => ({
  DatabaseService: {
    getInstance: () => mockDB
  }
}));

jest.mock('../services/zombieService', () => ({
  ZombieService: {
    getInstance: () => mockZombieService
  },
  ThreatLevel: {
    NONE: 'none',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
  }
}));

describe('WorldMapService Map Persistence', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the singleton instance
    (WorldMapService as any).instance = null;
    
    // Mock successful database queries for initialization
    mockPool.query.mockResolvedValue({ rows: [] });
    mockZombieService.getThreatLevelAtLocation.mockResolvedValue('none');
    mockZombieService.clearAllZombies.mockResolvedValue(true);
    mockZombieService.initializeWorldZombies.mockResolvedValue(undefined);
  });

  test('should load explored tiles from database on initialization', async () => {
    const mockExploredTiles = [
      { x: 6, y: 6 },
      { x: 5, y: 5 },
      { x: 7, y: 7 }
    ];
    
    mockPool.query.mockResolvedValue({ rows: mockExploredTiles });
    
    worldMapService = WorldMapService.getInstance();
    
    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockPool.query).toHaveBeenCalledWith('SELECT x, y FROM explored_tiles');
    expect(worldMapService.getTileState(6, 6)).toBe('town'); // Center is always town
    expect(worldMapService.getTileState(5, 5)).toBe('explored');
    expect(worldMapService.getTileState(7, 7)).toBe('explored');
  });

  test('should initialize starting area when no explored tiles in database', async () => {
    // First call returns no tiles, subsequent calls for insertions succeed
    mockPool.query
      .mockResolvedValueOnce({ rows: [] }) // Initial load - no tiles
      .mockResolvedValue({}); // Insert queries succeed
    
    worldMapService = WorldMapService.getInstance();
    
    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Should have called insert for center tile and 8 surrounding tiles
    expect(mockPool.query).toHaveBeenCalledWith('SELECT x, y FROM explored_tiles');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO explored_tiles'),
      expect.any(Array)
    );
  });

  test('should persist new explored tiles to database', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    
    worldMapService = WorldMapService.getInstance();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Clear previous calls
    mockPool.query.mockClear();
    mockPool.query.mockResolvedValue({});
    
    // Mark a new tile as explored
    worldMapService.markTileExplored(3, 3);
    
    // Wait for async persistence
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO explored_tiles'),
      [3, 3]
    );
  });

  test('resetMap should clear database and reinitialize', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    
    worldMapService = WorldMapService.getInstance();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Clear previous calls
    mockPool.query.mockClear();
    mockPool.query.mockResolvedValue({});
    
    // Reset the map
    await worldMapService.resetMap();
    
    expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM explored_tiles');
    expect(mockZombieService.clearAllZombies).toHaveBeenCalled();
    expect(mockZombieService.initializeWorldZombies).toHaveBeenCalled();
  });

  test('should handle database errors gracefully during initialization', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockPool.query.mockRejectedValue(new Error('Database connection failed'));
    
    // Should not throw
    expect(() => {
      worldMapService = WorldMapService.getInstance();
    }).not.toThrow();
    
    consoleErrorSpy.mockRestore();
  });

  test('should handle database errors gracefully during tile marking', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    mockPool.query.mockResolvedValue({ rows: [] });
    
    worldMapService = WorldMapService.getInstance();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Make the insert fail
    mockPool.query.mockRejectedValue(new Error('Insert failed'));
    
    // Should not throw
    expect(() => {
      worldMapService.markTileExplored(3, 3);
    }).not.toThrow();
    
    // Should still update in-memory state
    expect(worldMapService.getTileState(3, 3)).toBe('explored');
    
    consoleErrorSpy.mockRestore();
  });
});