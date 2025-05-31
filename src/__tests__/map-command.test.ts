// Test to verify the map command is properly structured
describe('Map Command', () => {
  test('should have map command properly structured', () => {
    const mapCommand = require('../commands/map');
    
    expect(mapCommand.data).toBeDefined();
    expect(mapCommand.data.name).toBe('map');
    expect(mapCommand.data.description).toBe('Display the current area without moving or using energy');
    expect(mapCommand.execute).toBeDefined();
    expect(typeof mapCommand.execute).toBe('function');
  });

  test('should include no-emoji comment', () => {
    const fs = require('fs');
    const path = require('path');
    const mapCommandContent = fs.readFileSync(path.join(__dirname, '../commands/map.ts'), 'utf8');
    
    expect(mapCommandContent).toContain('IMPORTANT: No emojis must be added to any part of a command');
  });
});