import { CUSTOM_EMOJIS, getCustomEmoji, getEmojiConfig } from '../config/emojis';

describe('Emoji Configuration', () => {
  test('should have all required map emojis defined', () => {
    const requiredEmojis = [
      'z_gate',
      'z_evergreen_tree', 
      'z_factory',
      'z_house',
      'z_house_with_garden',
      'z_house_abandoned',
      'z_convience_store',
      'z_office',
      'z_hospital',
      'z_school',
      'z_department_store',
      'z_hotel',
      'z_fountain',
      'z_ferris_wheel',
      'z_construction_site',
      'z_tokyo_tower',
      'z_campsite',
      'z_pond',
      'z_player'
    ];

    requiredEmojis.forEach(emojiName => {
      expect(CUSTOM_EMOJIS[emojiName]).toBeDefined();
      expect(CUSTOM_EMOJIS[emojiName]).toMatch(/^<:z_\w+:000000000000000000>$/);
    });
  });

  test('should have proper Discord emoji format', () => {
    Object.values(CUSTOM_EMOJIS).forEach(emoji => {
      // Should match Discord custom emoji format: <:name:id>
      expect(emoji).toMatch(/^<:[a-z_]+:\d{18}>$/);
    });
  });

  test('getCustomEmoji should return proper emoji', () => {
    expect(getCustomEmoji('gate')).toBe('<:z_gate:000000000000000000>');
    expect(getCustomEmoji('z_gate')).toBe('<:z_gate:000000000000000000>');
    expect(getCustomEmoji('nonexistent')).toBe('❓');
  });

  test('getEmojiConfig should return configuration', () => {
    const config = getEmojiConfig();
    expect(config).toHaveProperty('z_gate');
    expect(config).toHaveProperty('z_player');
    expect(Object.keys(config).length).toBe(19); // 19 emojis total
  });

  test('should support environment variable overrides', () => {
    // Set an environment variable
    process.env.EMOJI_Z_GATE = '<:z_gate:999999999999999999>';
    
    const config = getEmojiConfig();
    expect(config.z_gate).toBe('<:z_gate:999999999999999999>');
    
    // Clean up
    delete process.env.EMOJI_Z_GATE;
  });
});