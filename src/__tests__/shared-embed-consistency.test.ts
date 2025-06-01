// Test to verify shared embed consistency across /move, /map, and /depart commands
import { EmbedBuilder } from 'discord.js';

// Test the command implementations to ensure they use the shared utility correctly
describe('Shared Embed Consistency', () => {
  test('move command shows both action points used and remaining - code structure', () => {
    const fs = require('fs');
    const path = require('path');
    const moveCommandContent = fs.readFileSync(path.join(__dirname, '../commands/move.ts'), 'utf8');
    
    // Verify that move command uses createAreaEmbed
    expect(moveCommandContent).toContain('import { createAreaEmbed }');
    expect(moveCommandContent).toContain('createAreaEmbed({');
    
    // Verify it passes movement information
    expect(moveCommandContent).toContain('showMovement: true');
    expect(moveCommandContent).toContain('showScavenge: true');
    expect(moveCommandContent).toContain('previousLocation:');
    expect(moveCommandContent).toContain('actionPointsUsed: 1');
  });

  test('map command shows movement buttons - code structure', () => {
    const fs = require('fs');
    const path = require('path');
    const mapCommandContent = fs.readFileSync(path.join(__dirname, '../commands/map.ts'), 'utf8');
    
    // Verify that map command uses createAreaEmbed with movement enabled
    expect(mapCommandContent).toContain('import { createAreaEmbed }');
    expect(mapCommandContent).toContain('createAreaEmbed({');
    expect(mapCommandContent).toContain('showMovement: true');
    expect(mapCommandContent).toContain('showScavenge: true');
  });

  test('depart command shows movement options - code structure', () => {
    const fs = require('fs');
    const path = require('path');
    const departCommandContent = fs.readFileSync(path.join(__dirname, '../commands/depart.ts'), 'utf8');
    
    // Verify that depart command uses createAreaEmbed with movement enabled
    expect(departCommandContent).toContain('import { createAreaEmbed }');
    expect(departCommandContent).toContain('createAreaEmbed({');
    expect(departCommandContent).toContain('showMovement: true');
    expect(departCommandContent).toContain('showScavenge: false'); // No scavenging at gate
  });

  test('createAreaEmbed supports showing both action points used and remaining for movement', () => {
    const fs = require('fs');
    const path = require('path');
    const embedUtilsContent = fs.readFileSync(path.join(__dirname, '../utils/embedUtils.ts'), 'utf8');
    
    // Verify that movement actions show both action points used and remaining
    expect(embedUtilsContent).toContain('Action Points Used');
    expect(embedUtilsContent).toContain('Action Points Remaining');
    
    // Verify that both fields are shown for movement actions (when previousLocation && actionPointsUsed are present)
    const movementSection = embedUtilsContent.substring(
      embedUtilsContent.indexOf('if (previousLocation && actionPointsUsed !== undefined)'),
      embedUtilsContent.indexOf('} else {')
    );
    
    expect(movementSection).toContain('Action Points Used');
    expect(movementSection).toContain('Action Points Remaining');
    expect(movementSection).toContain('actionPointsUsed.toString()');
    expect(movementSection).toContain('${player.actionPoints}/${player.maxActionPoints}');
  });

  test('all three commands use consistent embed structure', () => {
    const fs = require('fs');
    const path = require('path');
    
    const moveCommandContent = fs.readFileSync(path.join(__dirname, '../commands/move.ts'), 'utf8');
    const mapCommandContent = fs.readFileSync(path.join(__dirname, '../commands/map.ts'), 'utf8');
    const departCommandContent = fs.readFileSync(path.join(__dirname, '../commands/depart.ts'), 'utf8');
    
    // All should import and use createAreaEmbed
    [moveCommandContent, mapCommandContent, departCommandContent].forEach(content => {
      expect(content).toContain('import { createAreaEmbed }');
      expect(content).toContain('const { embed, attachment, components } = await createAreaEmbed({');
    });
    
    // All should handle the response consistently
    [moveCommandContent, mapCommandContent, departCommandContent].forEach(content => {
      expect(content).toContain('embeds: [embed]');
      expect(content).toContain('files: [attachment]');
      expect(content).toContain('components');
    });
  });

  test('createAreaEmbed interface supports all required features for consistency', () => {
    const fs = require('fs');
    const path = require('path');
    const embedUtilsContent = fs.readFileSync(path.join(__dirname, '../utils/embedUtils.ts'), 'utf8');
    
    // Check that the interface supports all features needed for consistency
    expect(embedUtilsContent).toContain('showMovement?: boolean');
    expect(embedUtilsContent).toContain('showScavenge?: boolean');
    expect(embedUtilsContent).toContain('previousLocation?:');
    expect(embedUtilsContent).toContain('actionPointsUsed?: number');
    
    // Check that movement buttons are conditionally added
    expect(embedUtilsContent).toContain('if (showMovement)');
    expect(embedUtilsContent).toContain('move_north');
    expect(embedUtilsContent).toContain('move_south');
    expect(embedUtilsContent).toContain('move_east');
    expect(embedUtilsContent).toContain('move_west');
    
    // Check that scavenge button is conditionally added
    expect(embedUtilsContent).toContain('if (showScavenge');
    expect(embedUtilsContent).toContain('scavenge_area');
  });
});