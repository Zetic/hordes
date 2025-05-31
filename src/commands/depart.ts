import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { WorldMapService } from '../services/worldMap';
import { Location, PlayerStatus } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const cityService = new CityService();
const gameEngine = GameEngine.getInstance();
const inventoryService = new InventoryService();
const worldMapService = WorldMapService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('depart')
    .setDescription('Leave the city through the gate'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      console.log(`🚪 Depart command initiated by ${discordId}`);

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        console.log(`❌ Depart blocked for ${discordId}: ${actionCheck.reason}`);
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Depart')
          .setDescription(actionCheck.reason || 'Unknown error');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check if we're in offline mode
      const gameState = await gameEngine.getCurrentGameState();
      const isOfflineMode = gameState?.cityId === 'offline-city';
      
      if (isOfflineMode) {
        console.log(`⚠️ Depart command attempted in offline mode by ${discordId}`);
        await interaction.reply({
          content: '⚠️ **Limited Functionality Mode**\n\nThe depart command is not available in offline mode due to database connectivity issues. Please contact an administrator to restore full functionality.',
          ephemeral: true
        });
        return;
      }

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in the city
      if (player.location !== Location.CITY) {
        await interaction.reply({
          content: '❌ You must be in the city to use `/depart`. You are currently outside the city.',
          ephemeral: true
        });
        return;
      }

      // Get city to check gate status
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ City not found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Check if gate is open
      if (!city.gateOpen) {
        await interaction.reply({
          content: '❌ The city gate is closed. You cannot leave the city. Use `/gate open` to open it first.',
          ephemeral: true
        });
        return;
      }

      // Check if player is encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      if (isEncumbered) {
        await interaction.reply({
          content: '❌ You are encumbered and cannot depart. Use `/drop <item>` to free up space first.',
          ephemeral: true
        });
        return;
      }

      // Defer reply since we're about to do expensive operations (map generation)
      await interaction.deferReply();

      // Get gate coordinates
      const gateCoords = worldMapService.getGateCoordinates();

      // Update player location to gate
      await playerService.updatePlayerLocation(discordId, Location.GATE, gateCoords.x, gateCoords.y);

      // Show map view
      const mapImageBuffer = await worldMapService.generateMapView(playerService);
      const mapAttachment = new AttachmentBuilder(mapImageBuffer, { name: 'map.png' });

      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('🚪 Departed from City')
        .setDescription(`${player.name} leaves the safety of the city through the gate...`)
        .addFields([
          { 
            name: '📍 Previous Location', 
            value: '🏠 City (Safe Zone)', 
            inline: true 
          },
          { 
            name: '📍 New Location', 
            value: `🚪 Gate (${gateCoords.x}, ${gateCoords.y})`, 
            inline: true 
          },
          { 
            name: '✅ Status', 
            value: 'Ready to explore', 
            inline: true 
          }
        ])
        .addFields([
          {
            name: '🚪 Gate Area',
            value: 'You are now at the gate to the wasteland. You can explore in any direction using `/move <direction>` or return to the city with `/return`.',
            inline: false
          }
        ])
        .setImage('attachment://map.png')
        .addFields([
          {
            name: '⚠️ Warning',
            value: 'You are no longer in the safety of the city. Be careful when searching for items!',
            inline: false
          }
        ])
        .addFields([
          {
            name: '🔍 Next Steps',
            value: '• Use `/move <direction>` to explore (8 directions available)\n• Use `/return` to go back to the city\n• Use `/status` to check your condition',
            inline: false
          }
        ])
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], files: [mapAttachment] });

    } catch (error) {
      console.error('Error in depart command:', error);
      
      // Check if reply was already deferred
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while departing from the city.'
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while departing from the city.',
          ephemeral: true
        });
      }
    }
  }
};