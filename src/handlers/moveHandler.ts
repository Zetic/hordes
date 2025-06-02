import { ButtonInteraction, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { WorldMapService } from '../services/worldMap';
import { ZoneContestService } from '../services/zoneContest';
import { ZombieService } from '../services/zombieService';
import { Location, Direction, PlayerStatus, isWoundType } from '../types/game';
import { createAreaEmbed } from '../utils/embedUtils';

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

    // Check if player can perform action (1 AP required for moving)
    const actionCheck = await gameEngine.canPerformAction(discordId, 1);
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

    // Get updated player with new location
    const updatedPlayer = await playerService.getPlayer(discordId);
    if (!updatedPlayer) {
      await interaction.editReply({
        content: '❌ Error retrieving updated player data.',
        embeds: [],
        components: []
      });
      return;
    }

    // Create response embed using shared function
    const directionDisplay = worldMapService.getDirectionDisplayName(directionEnum);
    const currentLocationDisplay = worldMapService.getLocationDisplay(player.location);

    // Generate map view
    const mapImageBuffer = await worldMapService.generateMapView(playerService);
    
    // Create standardized area embed with movement information
    const { embed, attachment, components } = await createAreaEmbed({
      player: updatedPlayer,
      title: `🚶 Movement: ${directionDisplay}`,
      description: `${player.name} moves ${directionDisplay.toLowerCase()}...`,
      showMovement: true,
      showScavenge: true,
      mapImageBuffer,
      previousLocation: {
        name: currentLocationDisplay.name,
        emoji: currentLocationDisplay.emoji,
        x: currentX,
        y: currentY
      },
      actionPointsUsed: 1
    });

    // Add location-specific information for gate
    if (newLocation === Location.GATE) {
      embed.addFields([
        {
          name: '🚪 Gate Area',
          value: 'You are at the gate to town. Use `/return` to enter the city (if the gate is open).',
          inline: false
        }
      ]);
    }

    await interaction.editReply({ embeds: [embed], files: [attachment], components });

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