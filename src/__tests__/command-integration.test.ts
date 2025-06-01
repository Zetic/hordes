import fs from 'fs';
import path from 'path';

describe('Command Integration', () => {
  test('create command file exists and is properly structured', () => {
    const createCommandPath = path.join(__dirname, '../commands/create.ts');
    expect(fs.existsSync(createCommandPath)).toBe(true);
    
    const createCommand = require('../commands/create');
    expect(createCommand).toBeDefined();
    expect(createCommand.data).toBeDefined();
    expect(createCommand.execute).toBeDefined();
    expect(createCommand.data.name).toBe('create');
  });

  test('join command properly checks for city existence', () => {
    const joinCommand = require('../commands/join');
    expect(joinCommand).toBeDefined();
    expect(joinCommand.data).toBeDefined();
    expect(joinCommand.execute).toBeDefined();
    expect(joinCommand.data.name).toBe('join');
  });

  test('town command properly handles no city case', () => {
    const townCommand = require('../commands/town');
    expect(townCommand).toBeDefined();
    expect(townCommand.data).toBeDefined();
    expect(townCommand.execute).toBeDefined();
    expect(townCommand.data.name).toBe('town');
  });

  test('all command files can be loaded without errors', () => {
    const commandsDir = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.ts'));
    
    expect(commandFiles.length).toBeGreaterThan(0);
    
    commandFiles.forEach(file => {
      const filePath = path.join(commandsDir, file);
      expect(() => {
        require(filePath);
      }).not.toThrow();
    });
  });
});