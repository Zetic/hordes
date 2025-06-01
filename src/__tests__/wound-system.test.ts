import { PlayerStatus, isWoundType } from '../types/game';

describe('Wound System', () => {
  test('should identify wound types correctly', () => {
    expect(isWoundType(PlayerStatus.WOUNDED_ARM)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_EYE)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_FOOT)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_HAND)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_HEAD)).toBe(true);
    expect(isWoundType(PlayerStatus.WOUNDED_LEG)).toBe(true);
    
    expect(isWoundType(PlayerStatus.ALIVE)).toBe(false);
    expect(isWoundType(PlayerStatus.DEAD)).toBe(false);
    expect(isWoundType(PlayerStatus.REFRESHED)).toBe(false);
    expect(isWoundType(PlayerStatus.FED)).toBe(false);
  });

  test('should have correct wound type values', () => {
    expect(PlayerStatus.WOUNDED_ARM).toBe('wounded_arm');
    expect(PlayerStatus.WOUNDED_EYE).toBe('wounded_eye');
    expect(PlayerStatus.WOUNDED_FOOT).toBe('wounded_foot');
    expect(PlayerStatus.WOUNDED_HAND).toBe('wounded_hand');
    expect(PlayerStatus.WOUNDED_HEAD).toBe('wounded_head');
    expect(PlayerStatus.WOUNDED_LEG).toBe('wounded_leg');
  });

  test('should have correct new condition values', () => {
    expect(PlayerStatus.HEALED).toBe('healed');
    expect(PlayerStatus.INFECTED).toBe('infected');
  });

  test('should have ALIVE status instead of HEALTHY', () => {
    expect(PlayerStatus.ALIVE).toBe('alive');
    expect(PlayerStatus.DEAD).toBe('dead');
  });
});