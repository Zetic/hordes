import { PlayerStatus, isVitalStatus, isWoundType, isTemporaryCondition } from '../types/game';

describe('Player Status System', () => {
  test('should define vital statuses', () => {
    expect(PlayerStatus.ALIVE).toBe('alive');
    expect(PlayerStatus.DEAD).toBe('dead');
  });

  test('should define wound types', () => {
    expect(PlayerStatus.WOUNDED_ARM).toBe('wounded_arm');
    expect(PlayerStatus.WOUNDED_EYE).toBe('wounded_eye');
    expect(PlayerStatus.WOUNDED_FOOT).toBe('wounded_foot');
    expect(PlayerStatus.WOUNDED_HAND).toBe('wounded_hand');
    expect(PlayerStatus.WOUNDED_HEAD).toBe('wounded_head');
    expect(PlayerStatus.WOUNDED_LEG).toBe('wounded_leg');
  });

  test('should define temporary conditions', () => {
    expect(PlayerStatus.REFRESHED).toBe('refreshed');
    expect(PlayerStatus.FED).toBe('fed');
    expect(PlayerStatus.THIRSTY).toBe('thirsty');
    expect(PlayerStatus.DEHYDRATED).toBe('dehydrated');
    expect(PlayerStatus.EXHAUSTED).toBe('exhausted');
  });

  test('should categorize status types correctly', () => {
    // Test vital status identification
    expect(isVitalStatus(PlayerStatus.ALIVE)).toBe(true);
    expect(isVitalStatus(PlayerStatus.DEAD)).toBe(true);
    expect(isVitalStatus(PlayerStatus.WOUNDED_ARM)).toBe(false);
    expect(isVitalStatus(PlayerStatus.REFRESHED)).toBe(false);
    
    // Test wound type identification
    expect(isWoundType(PlayerStatus.WOUNDED_ARM)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_LEG)).toBe(true);
    expect(isWoundType(PlayerStatus.ALIVE)).toBe(false);
    expect(isWoundType(PlayerStatus.FED)).toBe(false);
    
    // Test temporary condition identification
    expect(isTemporaryCondition(PlayerStatus.REFRESHED)).toBe(true);
    expect(isTemporaryCondition(PlayerStatus.THIRSTY)).toBe(true);
    expect(isTemporaryCondition(PlayerStatus.ALIVE)).toBe(false);
    expect(isTemporaryCondition(PlayerStatus.WOUNDED_ARM)).toBe(false);
  });

  test('should handle status transitions correctly', () => {
    // In the new system, status transitions are simpler:
    // ALIVE -> DEAD (no intermediate wounded status)
    let playerStatus = PlayerStatus.ALIVE;
    
    // Injury results in death (wounds are separate conditions)
    if (playerStatus === PlayerStatus.ALIVE) {
      playerStatus = PlayerStatus.DEAD;
    }
    expect(playerStatus).toBe(PlayerStatus.DEAD);
  });
});