import { GamePhase, Location, ItemType, PlayerStatus } from '../types/game';

describe('Game Types', () => {
  test('should define game phases', () => {
    expect(GamePhase.PLAY_MODE).toBe('play_mode');
    expect(GamePhase.HORDE_MODE).toBe('horde_mode');
  });

  test('should define locations', () => {
    expect(Location.CITY).toBe('city');
    expect(Location.GATE).toBe('gate');
    expect(Location.WASTE).toBe('waste');
  });

  test('should define item types', () => {
    expect(ItemType.WEAPON).toBe('weapon');
    expect(ItemType.RESOURCE).toBe('resource');
  });

  test('should define player statuses', () => {
    expect(PlayerStatus.ALIVE).toBe('alive');
    expect(PlayerStatus.DEAD).toBe('dead');
  });
});

describe('Environment Configuration', () => {
  test('should load environment variables', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});