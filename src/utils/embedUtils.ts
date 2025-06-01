import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Player, Location } from '../types/game';
import { WorldMapService } from '../services/worldMap';
import { AreaInventoryService } from '../models/areaInventory';

const worldMapService = WorldMapService.getInstance();
const areaInventoryService = new AreaInventoryService();

export interface AreaEmbedOptions {
  player: Player;
  title?: string;
  description?: string;
  showMovement?: boolean;
  showScavenge?: boolean;
  mapImageBuffer: Buffer;
  // Movement-specific options
  previousLocation?: {
    name: string;
    emoji: string;
    x: number;
    y: number;
  };
  actionPointsUsed?: number;
}

/**
 * Creates a standardized area embed used by /depart, /move, and /map commands
 */
export async function createAreaEmbed(options: AreaEmbedOptions): Promise<{
  embed: EmbedBuilder;
  attachment: AttachmentBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const { player, title, description, showMovement = true, showScavenge = true, mapImageBuffer, previousLocation, actionPointsUsed } = options;
  
  // Get location display info
  const locationDisplay = worldMapService.getLocationDisplay(player.location);
  
  // Get items in the area
  const areaItems = await areaInventoryService.getAreaInventory(player.location, player.x!, player.y!);
  
  // Create the embed
  const embed = new EmbedBuilder()
    .setColor('#95e1d3')
    .setTitle(title || `📍 ${locationDisplay.name}`)
    .setDescription(description || `${player.name} is at ${locationDisplay.name}`)
    .setImage('attachment://map.png');

  // Add movement-specific fields if this is a movement action
  if (previousLocation && actionPointsUsed !== undefined) {
    embed.addFields([
      { 
        name: '📍 Previous Location', 
        value: `${previousLocation.emoji} ${previousLocation.name} (${previousLocation.x}, ${previousLocation.y})`, 
        inline: true 
      },
      { 
        name: '📍 New Location', 
        value: `${locationDisplay.emoji} ${locationDisplay.name} (${player.x}, ${player.y})`, 
        inline: true 
      },
      { 
        name: '⚡ Action Points Remaining', 
        value: `${player.actionPoints}/${player.maxActionPoints}`, 
        inline: true 
      }
    ]);
  } else {
    // Standard location fields for non-movement actions
    embed.addFields([
      { 
        name: '📍 Current Location', 
        value: `${locationDisplay.emoji} ${locationDisplay.name} (${player.x}, ${player.y})`, 
        inline: true 
      },
      { 
        name: '⚡ Action Points Remaining', 
        value: `${player.actionPoints}/${player.maxActionPoints}`, 
        inline: true 
      }
    ]);
  }

  // Add items on ground if any
  if (areaItems.length > 0) {
    const itemList = areaItems.map(item => 
      `**${item.item.name}** x${item.quantity} - ${item.item.description}`
    ).join('\n');

    embed.addFields([
      {
        name: '📦 Items on the Ground',
        value: itemList,
        inline: false
      }
    ]);
  }

  // Add next steps field
  embed.addFields([
    {
      name: '🔍 Next Steps',
      value: areaItems.length > 0 
        ? '• Use `/take <item>` to pick up items from the ground\n• Use movement buttons below to explore further\n• Use `/status` to check your condition'
        : '• Use movement buttons below to explore further\n• Use `/status` to check your condition',
      inline: false
    }
  ]);

  embed.setTimestamp();

  // Create map attachment
  const mapAttachment = new AttachmentBuilder(mapImageBuffer, { name: 'map.png' });

  // Create components
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  // Add movement buttons if requested
  if (showMovement) {
    const northButton = new ButtonBuilder()
      .setCustomId('move_north')
      .setLabel('⬆️ North')
      .setStyle(ButtonStyle.Secondary);
    
    const southButton = new ButtonBuilder()
      .setCustomId('move_south')
      .setLabel('⬇️ South')
      .setStyle(ButtonStyle.Secondary);
    
    const westButton = new ButtonBuilder()
      .setCustomId('move_west')
      .setLabel('⬅️ West')
      .setStyle(ButtonStyle.Secondary);
    
    const eastButton = new ButtonBuilder()
      .setCustomId('move_east')
      .setLabel('➡️ East')
      .setStyle(ButtonStyle.Secondary);

    const movementRow = new ActionRowBuilder<ButtonBuilder>().addComponents(northButton, westButton, eastButton, southButton);
    components.push(movementRow);
  }

  // Add scavenging button if requested and location allows it
  if (showScavenge && player.location !== Location.GATE && player.location !== Location.CITY && player.location !== Location.HOME) {
    const scavengeButton = new ButtonBuilder()
      .setCustomId('scavenge_area')
      .setLabel('🔍 Scavenge')
      .setStyle(ButtonStyle.Primary);
    
    const scavengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(scavengeButton);
    components.push(scavengeRow);
  }

  return {
    embed,
    attachment: mapAttachment,
    components
  };
}