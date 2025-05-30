import { WorldMapService } from '../services/worldMap';
import { Location } from '../types/game';

describe('Status Command Fix', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
  });

  test('should import worldMap service without dynamic import issues', () => {
    // This test verifies that the worldMap service can be imported directly
    // without the "Cannot find module 'canvas'" error that occurred with dynamic imports
    expect(worldMapService).toBeDefined();
    expect(typeof worldMapService.getLocationDisplay).toBe('function');
  });

  test('should be able to use worldMap service functionality', () => {
    // Test that the worldMap service actually works
    const display = worldMapService.getLocationDisplay(Location.CITY);
    expect(display).toBeDefined();
    // getLocationDisplay returns an object, not a string
    expect(typeof display).toBe('object');
  });

  test('should load status command without module resolution errors', () => {
    // Test that the status command can be required without import errors
    const path = require('path');
    const statusPath = path.resolve('./dist/commands/status.js');
    
    expect(() => {
      delete require.cache[statusPath];
      const statusCommand = require(statusPath);
      expect(statusCommand.data).toBeDefined();
      expect(statusCommand.execute).toBeDefined();
      expect(statusCommand.data.name).toBe('status');
    }).not.toThrow();
  });
});