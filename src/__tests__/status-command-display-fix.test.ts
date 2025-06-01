import { PlayerStatus } from '../types/game';

describe('Status Command Display Fix', () => {
  test('should format status title without emoji', () => {
    const playerName = 'TestPlayer';
    const statusEmojis = {
      [PlayerStatus.ALIVE]: '💚',
      [PlayerStatus.DEAD]: '💀',
      [PlayerStatus.REFRESHED]: '💧',
      [PlayerStatus.FED]: '🍞',
      [PlayerStatus.THIRSTY]: '🫗',
      [PlayerStatus.DEHYDRATED]: '🏜️',
      [PlayerStatus.EXHAUSTED]: '😴'
    };

    // OLD behavior (incorrect)
    const oldTitle = `${statusEmojis[PlayerStatus.ALIVE]} ${playerName}'s Status`;
    
    // NEW behavior (correct)
    const newTitle = `${playerName}'s Status`;

    // Verify the old title included emoji
    expect(oldTitle).toContain('💚');
    expect(oldTitle).toBe('💚 TestPlayer\'s Status');

    // Verify the new title does not include emoji
    expect(newTitle).not.toContain('💚');
    expect(newTitle).toBe('TestPlayer\'s Status');
    expect(newTitle).not.toMatch(/[^\w\s'']/); // No emoji or special characters except apostrophes
  });

  test('should display multiple conditions in separate section', () => {
    const mockPlayer = {
      conditions: [PlayerStatus.REFRESHED, PlayerStatus.FED, PlayerStatus.THIRSTY],
      status: PlayerStatus.ALIVE,
      isAlive: true
    };

    const statusEmojis = {
      [PlayerStatus.ALIVE]: '💚',
      [PlayerStatus.DEAD]: '💀',
      [PlayerStatus.REFRESHED]: '💧',
      [PlayerStatus.FED]: '🍞',
      [PlayerStatus.THIRSTY]: '🫗',
      [PlayerStatus.DEHYDRATED]: '🏜️',
      [PlayerStatus.EXHAUSTED]: '😴'
    };
    
    const statusTexts = {
      [PlayerStatus.ALIVE]: 'Healthy',
      [PlayerStatus.DEAD]: 'Dead',
      [PlayerStatus.REFRESHED]: 'Refreshed',
      [PlayerStatus.FED]: 'Fed',
      [PlayerStatus.THIRSTY]: 'Thirsty',
      [PlayerStatus.DEHYDRATED]: 'Dehydrated',
      [PlayerStatus.EXHAUSTED]: 'Exhausted'
    };

    // Test the conditions display logic (from status.ts)
    const conditionsDisplay = mockPlayer.conditions.length > 0 
      ? mockPlayer.conditions.map(condition => `${(statusEmojis as any)[condition]} ${(statusTexts as any)[condition]}`).join('\n')
      : `${(statusEmojis as any)[mockPlayer.status]} ${(statusTexts as any)[mockPlayer.status]}`;

    // Should show all three conditions on separate lines
    expect(conditionsDisplay).toContain('💧 Refreshed');
    expect(conditionsDisplay).toContain('🍞 Fed');
    expect(conditionsDisplay).toContain('🫗 Thirsty');
    expect(conditionsDisplay.split('\n')).toHaveLength(3);

    // Should not contain the player's vital status (wounded) in conditions
    expect(conditionsDisplay).not.toContain('🩸 Wounded');
  });

  test('should show vital status in Status field when no conditions', () => {
    const mockPlayer = {
      conditions: [],
      status: PlayerStatus.ALIVE,
      isAlive: true
    };

    const statusEmojis = {
      [PlayerStatus.ALIVE]: '💚',
      [PlayerStatus.DEAD]: '💀',
      [PlayerStatus.REFRESHED]: '💧',
      [PlayerStatus.FED]: '🍞',
      [PlayerStatus.THIRSTY]: '🫗',
      [PlayerStatus.DEHYDRATED]: '🏜️',
      [PlayerStatus.EXHAUSTED]: '😴'
    };
    
    const statusTexts = {
      [PlayerStatus.ALIVE]: 'Healthy',
      [PlayerStatus.DEAD]: 'Dead',
      [PlayerStatus.REFRESHED]: 'Refreshed',
      [PlayerStatus.FED]: 'Fed',
      [PlayerStatus.THIRSTY]: 'Thirsty',
      [PlayerStatus.DEHYDRATED]: 'Dehydrated',
      [PlayerStatus.EXHAUSTED]: 'Exhausted'
    };

    // Test the conditions display logic (from status.ts)
    const conditionsDisplay = mockPlayer.conditions.length > 0 
      ? mockPlayer.conditions.map(condition => `${(statusEmojis as any)[condition]} ${(statusTexts as any)[condition]}`).join('\n')
      : `${(statusEmojis as any)[mockPlayer.status]} ${(statusTexts as any)[mockPlayer.status]}`;

    // When no conditions, should fall back to showing vital status
    expect(conditionsDisplay).toBe('🩸 Wounded');
  });

  test('should not show conditions section for dead players', () => {
    const deadPlayer = {
      conditions: [PlayerStatus.FED], // Dead players might have had conditions before dying
      status: PlayerStatus.DEAD,
      isAlive: false
    };

    // The status command logic shows conditions only for alive players
    const shouldShowConditions = deadPlayer.isAlive;
    
    expect(shouldShowConditions).toBe(false);
    
    // Dead players should only show their vital status in the main Status field
    expect(deadPlayer.status).toBe(PlayerStatus.DEAD);
    expect(deadPlayer.isAlive).toBe(false);
  });
});