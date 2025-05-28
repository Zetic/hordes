import { GamePhase, Location, ItemType } from '../types/game';

describe('Game Types', () => {
  test('should define game phases', () => {
    expect(GamePhase.PLAY_MODE).toBe('play_mode');
    expect(GamePhase.HORDE_MODE).toBe('horde_mode');
  });

  test('should define locations', () => {
    expect(Location.CITY).toBe('city');
    expect(Location.OUTSIDE).toBe('outside');
    expect(Location.GREATER_OUTSIDE).toBe('greater_outside');
  });

  test('should define item types', () => {
    expect(ItemType.WEAPON).toBe('weapon');
    expect(ItemType.RESOURCE).toBe('resource');
  });
});

describe('Environment Configuration', () => {
  test('should load environment variables', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});