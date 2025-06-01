import { ButtonInteraction, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { WorldMapService } from '../services/worldMap';
import { ZoneContestService } from '../services/zoneContest';
import { ZombieService } from '../services/zombieService';
import { Location, Direction, PlayerStatus, isWoundType } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();
const worldMapService = WorldMapService.getInstance();
const zoneContestService = ZoneContestService.getInstance();
const zombieService = ZombieService.getInstance();

export async function handleMoveButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    const [, direction] = customId.split('_');
    
    const discordId = interaction.user.id;

    // Check if player can perform action
    const actionCheck = await gameEngine.canPerformAction(discordId);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Move')
        .setDescription(actionCheck.reason || 'Unknown error');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found. Use `/join` to start playing.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is in a moveable location
    if (player.location === Location.CITY || player.location === Location.HOME) {
      await interaction.update({
        content: '❌ You cannot move from this location. Use `/depart` to leave town through the gate.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has valid coordinates
    if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
      await interaction.update({
        content: '❌ Invalid position. Please contact an administrator.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is encumbered
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    if (isEncumbered) {
      await interaction.update({
        content: '❌ You are encumbered and cannot move. Use `/drop <item>` to free up space first.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check zone contest status - can player leave current zone?
    const movementCheck = await zoneContestService.canPlayerMoveOut(player.x, player.y);
    if (!movementCheck.canMove) {
      // Get detailed contest information
      const zoneContest = await zoneContestService.getZoneContest(player.x, player.y);
      const zombies = await zombieService.getZombiesAtLocation(player.x, player.y);
      const zombieCount = zombies ? zombies.count : 0;
      
      // Check if player is wounded - only show flee button if not wounded
      const hasWound = isWoundType(player.status) || 
                       (player.conditions && player.conditions.some(condition => isWoundType(condition)));
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🚫 Zone Contested')
        .setDescription(movementCheck.reason || 'You cannot leave this zone.')
        .addFields([
          {
            name: '⚔️ Zone Status',
            value: 'This zone is contested by zombies. You must wait for the zone to become uncontested before you can move.',
            inline: false
          },
          {
            name: '📊 Contest Score',
            value: `**Human Control:** ${zoneContest.humanCp} CP\n**Zombie Control:** ${zoneContest.zombieCp} CP`,
            inline: true
          },
          {
            name: '🧟 Zombies Present',
            value: `${zombieCount} zombies in this area`,
            inline: true
          },
          {
            name: '💡 Recommendations',
            value: hasWound 
              ? '• Use items like Box Cutter to kill zombies\n• Call for help from other players\n• Wait for the zone to become uncontested'
              : '• Use items like Box Cutter to kill zombies\n• Call for help from other players\n• Wait for the zone to become uncontested\n• Use the Flee button below to escape (you will be wounded)',
            inline: false
          }
        ]);

      // Add flee button if player is not wounded
      const components: any[] = [];
      if (!hasWound) {
        const fleeButton = new ButtonBuilder()
          .setCustomId(`flee_${direction}_${player.x}_${player.y}`)
          .setLabel('🏃 Flee!')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(fleeButton);
        components.push(row);
      }

      await interaction.update({ 
        embeds: [embed], 
        components: components
      });
      return;
    }

    // Defer update since we're about to do expensive operations (map generation and movement processing)
    await interaction.deferUpdate();

    // Calculate new coordinates
    const currentX = player.x;
    const currentY = player.y;
    const directionEnum = direction as Direction;
    const newCoords = worldMapService.getCoordinateInDirection(currentX, currentY, directionEnum);

    // Check if new coordinates are valid
    if (!worldMapService.isValidCoordinate(newCoords.x, newCoords.y)) {
      await interaction.editReply({
        content: 'The hordes rest beyond this point...',
        embeds: [],
        components: []
      });
      return;
    }

    // Spend action points (1 AP for movement)
    const success = await playerService.spendActionPoints(discordId, 1);
    if (!success) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need 1 action point to move.');

      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // Get new location type
    const newLocation = worldMapService.getLocationAtCoordinate(newCoords.x, newCoords.y);

    // Mark tile as explored (discover it when player moves there)
    worldMapService.markTileExplored(newCoords.x, newCoords.y);

    // Update player position
    await playerService.updatePlayerLocation(discordId, newLocation, newCoords.x, newCoords.y);

    // Update zone contest status for both zones
    await zoneContestService.onPlayerLeaveZone(currentX, currentY); // Player left old zone
    await zoneContestService.onPlayerEnterZone(newCoords.x, newCoords.y); // Player entered new zone

    // Get items in the new area
    const areaItems = await areaInventoryService.getAreaInventory(newLocation, newCoords.x, newCoords.y);

    // Create response embed
    const directionDisplay = worldMapService.getDirectionDisplayName(directionEnum);
    const locationDisplay = worldMapService.getLocationDisplay(newLocation);
    const currentLocationDisplay = worldMapService.getLocationDisplay(player.location);

    const embed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle(`🚶 Movement: ${directionDisplay}`)
      .setDescription(`${player.name} moves ${directionDisplay.toLowerCase()}...`)
      .addFields([
        { 
          name: '📍 Previous Location', 
          value: `${currentLocationDisplay.emoji} ${currentLocationDisplay.name} (${currentX}, ${currentY})`, 
          inline: true 
        },
        { 
          name: '📍 New Location', 
          value: `${locationDisplay.emoji} ${locationDisplay.name} (${newCoords.x}, ${newCoords.y})`, 
          inline: true 
        },
        { 
          name: '⚡ Action Points Used', 
          value: '1', 
          inline: true 
        }
      ]);

    // Add location-specific information
    if (newLocation === Location.GREATER_WASTE) {
      embed.addFields([
        {
          name: '⚠️ Greater Waste',
          value: 'You are now in the dangerous outer reaches. Searching here is more risky but may yield better rewards.',
          inline: false
        }
      ]);
    } else if (newLocation === Location.GATE) {
      embed.addFields([
        {
          name: '🚪 Gate Area',
          value: 'You are at the gate to town. Use `/return` to enter the city (if the gate is open).',
          inline: false
        }
      ]);
    }

    // Show map view
    const mapImageBuffer = await worldMapService.generateMapView(playerService);
    const mapAttachment = new AttachmentBuilder(mapImageBuffer, { name: 'map.png' });
    
    embed.setImage('attachment://map.png');

    // Show items in area if any
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

    // Create movement buttons
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

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(northButton, westButton, eastButton, southButton);

    await interaction.editReply({ embeds: [embed], files: [mapAttachment], components: [row] });

  } catch (error) {
    console.error('Error handling move button:', error);
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while moving.',
        embeds: [],
        components: []
      });
    } catch (updateError) {
      console.error('Error updating interaction after error:', updateError);
    }
  }
}