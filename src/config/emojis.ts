/**
 * Discord Custom Emoji Configuration
 * 
 * Discord custom emojis must be formatted as: <:name:id> for regular emojis or <a:name:id> for animated emojis
 * These IDs are specific to the Discord server where the emojis are uploaded.
 * 
 * To get emoji IDs:
 * 1. In Discord, type \:emoji_name: and send the message
 * 2. The message will show the full emoji format with ID
 * 3. Update the IDs below accordingly
 * 
 * Note: These are placeholder IDs that need to be replaced with actual emoji IDs from your Discord server
 */

export interface EmojiConfig {
  [key: string]: string;
}

// Default emoji configuration with placeholder IDs
// Replace these IDs with actual emoji IDs from your Discord server
export const CUSTOM_EMOJIS: EmojiConfig = {
  // Map location emojis
  z_gate: '<:z_gate:000000000000000000>',
  z_evergreen_tree: '<:z_evergreen_tree:000000000000000000>',
  z_factory: '<:z_factory:000000000000000000>',
  z_house: '<:z_house:000000000000000000>',
  z_house_with_garden: '<:z_house_with_garden:000000000000000000>',
  z_house_abandoned: '<:z_house_abandoned:000000000000000000>',
  z_convience_store: '<:z_convience_store:000000000000000000>',
  z_office: '<:z_office:000000000000000000>',
  z_hospital: '<:z_hospital:000000000000000000>',
  z_school: '<:z_school:000000000000000000>',
  z_department_store: '<:z_department_store:000000000000000000>',
  z_hotel: '<:z_hotel:000000000000000000>',
  z_fountain: '<:z_fountain:000000000000000000>',
  z_ferris_wheel: '<:z_ferris_wheel:000000000000000000>',
  z_construction_site: '<:z_construction_site:000000000000000000>',
  z_tokyo_tower: '<:z_tokyo_tower:000000000000000000>',
  z_campsite: '<:z_campsite:000000000000000000>',
  z_pond: '<:z_pond:000000000000000000>',
  z_player: '<:z_player:000000000000000000>'
};

/**
 * Get a custom emoji by name
 * @param name - The emoji name (without z_ prefix)
 * @returns The formatted Discord emoji string
 */
export function getCustomEmoji(name: string): string {
  const emojiKey = name.startsWith('z_') ? name : `z_${name}`;
  return CUSTOM_EMOJIS[emojiKey] || '❓';
}

/**
 * Get emoji configuration from environment or use defaults
 * This allows server administrators to override emoji IDs via environment variables
 */
export function getEmojiConfig(): EmojiConfig {
  const config: EmojiConfig = { ...CUSTOM_EMOJIS };
  
  // Allow environment variable overrides
  Object.keys(CUSTOM_EMOJIS).forEach(key => {
    const envKey = `EMOJI_${key.toUpperCase()}`;
    if (process.env[envKey]) {
      config[key] = process.env[envKey];
    }
  });
  
  return config;
}