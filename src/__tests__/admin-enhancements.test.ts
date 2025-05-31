import { WorldMapService } from '../services/worldMap';

describe('Admin Command Enhancements', () => {
  let worldMapService: WorldMapService;

  beforeEach(() => {
    worldMapService = WorldMapService.getInstance();
  });

  test('should reset map state when resetMap is called', () => {
    // Mark some tiles as explored
    worldMapService.markTileExplored(0, 0);
    worldMapService.markTileExplored(1, 1);
    
    // Verify they are explored
    expect(worldMapService.getTileState(0, 0)).toBe('explored');
    expect(worldMapService.getTileState(1, 1)).toBe('explored');
    
    // Reset the map
    worldMapService.resetMap();
    
    // Should be back to hidden state
    expect(worldMapService.getTileState(0, 0)).toBe('hidden');
    expect(worldMapService.getTileState(1, 1)).toBe('hidden');
    
    // Center should still be town
    expect(worldMapService.getTileState(6, 6)).toBe('town');
    
    // Surrounding area should be explored
    expect(worldMapService.getTileState(5, 5)).toBe('explored');
    expect(worldMapService.getTileState(7, 7)).toBe('explored');
  });

  test('should have new admin command structure', () => {
    // This test verifies the admin command structure has been updated
    // We'll test this by importing the command and checking its structure
    const adminCommand = require('../commands/admin');
    
    expect(adminCommand.data).toBeDefined();
    expect(adminCommand.data.name).toBe('admin');
    expect(adminCommand.execute).toBeDefined();
    
    // Check that the new commands are available in choices
    const commandOption = adminCommand.data.options.find((opt: any) => opt.name === 'command');
    expect(commandOption).toBeDefined();
    
    const choices = commandOption.choices.map((choice: any) => choice.value);
    expect(choices).toContain('reset');
    expect(choices).toContain('respawn');
    expect(choices).toContain('return');
    expect(choices).toContain('revive');
    expect(choices).toContain('refresh');
    expect(choices).toContain('horde');
    expect(choices).toContain('hordesize');
  });
});