// Test to verify the area command is properly structured
describe('Area Command', () => {
  test('should have area command properly structured', () => {
    const areaCommand = require('../commands/area');
    
    expect(areaCommand.data).toBeDefined();
    expect(areaCommand.data.name).toBe('area');
    expect(areaCommand.data.description).toBe('Display the current area without moving or using energy');
    expect(areaCommand.execute).toBeDefined();
    expect(typeof areaCommand.execute).toBe('function');
  });

  test('should include no-emoji comment', () => {
    const fs = require('fs');
    const path = require('path');
    const areaCommandContent = fs.readFileSync(path.join(__dirname, '../commands/area.ts'), 'utf8');
    
    expect(areaCommandContent).toContain('IMPORTANT: No emojis must be added to any part of a command');
  });
});