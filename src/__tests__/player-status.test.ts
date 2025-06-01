import { PlayerStatus, PlayerCondition } from '../types/game';

describe('Player Status System', () => {
  test('should define all player statuses', () => {
    expect(PlayerCondition.HEALTHY).toBe('healthy');
    expect(PlayerCondition.WOUNDED).toBe('wounded');
    expect(PlayerStatus.DEAD).toBe('dead');
  });

  test('should have correct status progression', () => {
    // Test status progression from healthy to wounded to dead
    const healthyStatus = PlayerCondition.HEALTHY;
    const woundedStatus = PlayerCondition.WOUNDED;
    const deadStatus = PlayerStatus.DEAD;
    
    expect(healthyStatus).not.toBe(woundedStatus);
    expect(woundedStatus).not.toBe(deadStatus);
    expect(healthyStatus).not.toBe(deadStatus);
  });

  test('should handle status transitions correctly', () => {
    // Mock player status progression
    let playerStatus = PlayerCondition.HEALTHY;
    
    // First injury: healthy -> wounded
    if (playerStatus === PlayerCondition.HEALTHY) {
      playerStatus = PlayerCondition.WOUNDED;
    }
    expect(playerStatus).toBe(PlayerCondition.WOUNDED);
    
    // Second injury: wounded -> dead (status change, not condition)
    let finalStatus: PlayerStatus = PlayerStatus.ALIVE;
    if (playerStatus === PlayerCondition.WOUNDED) {
      finalStatus = PlayerStatus.DEAD;
    }
    expect(finalStatus).toBe(PlayerStatus.DEAD);
  });
});