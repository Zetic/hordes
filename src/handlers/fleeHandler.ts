import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { WorldMapService } from '../services/worldMap';
import { ZoneContestService } from '../services/zoneContest';
import { AreaInventoryService } from '../models/areaInventory';
import { Direction, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const worldMapService = WorldMapService.getInstance();
const zoneContestService = ZoneContestService.getInstance();
const areaInventoryService = new AreaInventoryService();

export async function handleFleeButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    const [, direction, fromX, fromY] = customId.split('_');
    
    const discordId = interaction.user.id;
    const player = await playerService.getPlayer(discordId);
    
    if (!player) {
      await interaction.reply({
        content: '❌ Player not found.',
        ephemeral: true
      });
      return;
    }

    // Defer reply since this involves complex operations
    await interaction.deferReply({ ephemeral: true });

    // Verify player is still at the expected location
    if (player.x !== parseInt(fromX) || player.y !== parseInt(fromY)) {
      await interaction.editReply({
        content: '❌ You are no longer at the original location.'
      });
      return;
    }

    // Calculate new coordinates based on direction
    const directionEnum = direction as Direction;
    const newCoords = worldMapService.getCoordinateInDirection(player.x, player.y, directionEnum);
    
    // Check if new coordinates are valid
    if (!worldMapService.isValidCoordinate(newCoords.x, newCoords.y)) {
      await interaction.editReply({
        content: '❌ Cannot flee in that direction - the hordes rest beyond this point...'
      });
      return;
    }

    // Spend action points (1 AP for movement)
    const success = await playerService.spendActionPoints(discordId, 1);
    if (!success) {
      await interaction.editReply({
        content: '❌ You need 1 action point to flee.'
      });
      return;
    }

    // Get new location type
    const newLocation = worldMapService.getLocationAtCoordinate(newCoords.x, newCoords.y);

    // Mark tile as explored
    worldMapService.markTileExplored(newCoords.x, newCoords.y);

    // Apply random wound for fleeing
    const woundTypes = [
      PlayerStatus.WOUNDED_ARM,
      PlayerStatus.WOUNDED_EYE,
      PlayerStatus.WOUNDED_FOOT,
      PlayerStatus.WOUNDED_HAND,
      PlayerStatus.WOUNDED_HEAD,
      PlayerStatus.WOUNDED_LEG
    ];
    const randomWound = woundTypes[Math.floor(Math.random() * woundTypes.length)];
    
    // Apply the wound as a condition
    await playerService.addPlayerCondition(discordId, randomWound);

    // Update player position
    await playerService.updatePlayerLocation(discordId, newLocation, newCoords.x, newCoords.y);

    // Update zone contest status
    await zoneContestService.onPlayerLeaveZone(parseInt(fromX), parseInt(fromY));
    await zoneContestService.onPlayerEnterZone(newCoords.x, newCoords.y);

    // Get items in the new area
    const areaItems = await areaInventoryService.getAreaInventory(newLocation, newCoords.x, newCoords.y);

    // Create response embed
    const directionDisplay = worldMapService.getDirectionDisplayName(directionEnum);
    const locationDisplay = worldMapService.getLocationDisplay(newLocation);
    
    const woundNames: { [key: string]: string } = {
      [PlayerStatus.WOUNDED_ARM]: 'Wounded Arm',
      [PlayerStatus.WOUNDED_EYE]: 'Wounded Eye', 
      [PlayerStatus.WOUNDED_FOOT]: 'Wounded Foot',
      [PlayerStatus.WOUNDED_HAND]: 'Wounded Hand',
      [PlayerStatus.WOUNDED_HEAD]: 'Wounded Head',
      [PlayerStatus.WOUNDED_LEG]: 'Wounded Leg'
    };

    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle(`🏃 Fled ${directionDisplay}`)
      .setDescription(`You successfully fled from the contested zone, but sustained injuries in the process!`)
      .addFields([
        {
          name: '📍 New Location',
          value: `${locationDisplay.emoji} ${locationDisplay.name} (${newCoords.x}, ${newCoords.y})`,
          inline: false
        },
        {
          name: '🩸 Injury Sustained',
          value: `You now have: ${woundNames[randomWound]}`,
          inline: false
        },
        ...(areaItems && areaItems.length > 0 ? [{
          name: '👁️ Items Spotted',
          value: areaItems.map(item => `• ${item.itemId} (${item.quantity})`).join('\n'),
          inline: false
        }] : [])
      ])
      .setTimestamp();

    // Add continue button to return to navigation
    const continueButton = new ButtonBuilder()
      .setCustomId('nav_back_map')
      .setLabel('🗺️ Continue Navigation')
      .setStyle(ButtonStyle.Primary);
    
    const continueRow = new ActionRowBuilder<ButtonBuilder>().addComponents(continueButton);

    await interaction.editReply({ embeds: [embed], components: [continueRow] });

  } catch (error) {
    console.error('Error handling flee button:', error);
    await interaction.editReply({
      content: '❌ An error occurred while trying to flee.'
    });
  }
}