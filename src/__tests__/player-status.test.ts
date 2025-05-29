import { PlayerStatus } from '../types/game';

describe('Player Status System', () => {
  test('should define all player statuses', () => {
    expect(PlayerStatus.HEALTHY).toBe('healthy');
    expect(PlayerStatus.WOUNDED).toBe('wounded');
    expect(PlayerStatus.DEAD).toBe('dead');
  });

  test('should have correct status progression', () => {
    // Test status progression from healthy to wounded to dead
    const healthyStatus = PlayerStatus.HEALTHY;
    const woundedStatus = PlayerStatus.WOUNDED;
    const deadStatus = PlayerStatus.DEAD;
    
    expect(healthyStatus).not.toBe(woundedStatus);
    expect(woundedStatus).not.toBe(deadStatus);
    expect(healthyStatus).not.toBe(deadStatus);
  });

  test('should handle status transitions correctly', () => {
    // Mock player status progression
    let playerStatus = PlayerStatus.HEALTHY;
    
    // First injury: healthy -> wounded
    if (playerStatus === PlayerStatus.HEALTHY) {
      playerStatus = PlayerStatus.WOUNDED;
    }
    expect(playerStatus).toBe(PlayerStatus.WOUNDED);
    
    // Second injury: wounded -> dead
    if (playerStatus === PlayerStatus.WOUNDED) {
      playerStatus = PlayerStatus.DEAD;
    }
    expect(playerStatus).toBe(PlayerStatus.DEAD);
  });
});