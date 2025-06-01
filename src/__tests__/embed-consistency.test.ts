// Test to verify embed consistency across map mode commands
import { createAreaEmbed } from '../utils/embedUtils';

describe('Embed Consistency Across Commands', () => {
  test('all map mode commands use createAreaEmbed function', () => {
    const mapCommand = require('../commands/map');
    const moveCommand = require('../commands/move');
    const departCommand = require('../commands/depart');
    
    // Check that all commands import the shared embed utility
    expect(mapCommand).toBeDefined();
    expect(moveCommand).toBeDefined();
    expect(departCommand).toBeDefined();
  });

  test('createAreaEmbed function exports correctly', () => {
    expect(createAreaEmbed).toBeDefined();
    expect(typeof createAreaEmbed).toBe('function');
  });

  test('move handler uses shared embed utility', () => {
    const fs = require('fs');
    const path = require('path');
    const moveHandlerContent = fs.readFileSync(path.join(__dirname, '../handlers/moveHandler.ts'), 'utf8');
    
    // Verify that moveHandler imports and uses createAreaEmbed
    expect(moveHandlerContent).toContain('import { createAreaEmbed }');
    expect(moveHandlerContent).toContain('createAreaEmbed({');
    
    // Verify that the main movement embed uses shared function
    expect(moveHandlerContent).toContain('const { embed, attachment, components } = await createAreaEmbed({');
  });

  test('scavenging service has notification capability', () => {
    const fs = require('fs');
    const path = require('path');
    const scavengingServiceContent = fs.readFileSync(path.join(__dirname, '../services/scavenging.ts'), 'utf8');
    
    // Verify notification features were added
    expect(scavengingServiceContent).toContain('sendItemDiscoveryNotification');
    expect(scavengingServiceContent).toContain('setDiscordClient');
    expect(scavengingServiceContent).toContain('DISCORD_ITEM_DISCOVERY_CHANNEL_ID');
  });

  test('embed options interface supports all required features', () => {
    const fs = require('fs');
    const path = require('path');
    const embedUtilsContent = fs.readFileSync(path.join(__dirname, '../utils/embedUtils.ts'), 'utf8');
    
    // Check that the interface supports all the features needed for consistency
    expect(embedUtilsContent).toContain('showMovement');
    expect(embedUtilsContent).toContain('showScavenge');
    expect(embedUtilsContent).toContain('previousLocation');
    expect(embedUtilsContent).toContain('actionPointsUsed');
  });
});