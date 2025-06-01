import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { WorldMapService } from '../services/worldMap';
import { Location, PlayerStatus } from '../types/game';
import { createAreaEmbed } from '../utils/embedUtils';

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

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Depart')
          .setDescription(actionCheck.reason || 'Unknown error');

        await interaction.reply({ embeds: [embed], ephemeral: true });
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

      // Send public departure message first
      await interaction.reply({
        content: `${player.name} has departed from the city and heads out into the wasteland...`,
        ephemeral: false
      });

      // Get gate coordinates
      const gateCoords = worldMapService.getGateCoordinates();

      // Update player location to gate
      await playerService.updatePlayerLocation(discordId, Location.GATE, gateCoords.x, gateCoords.y);

      // Get updated player with new location
      const updatedPlayer = await playerService.getPlayer(discordId);
      if (!updatedPlayer) {
        await interaction.followUp({
          content: '❌ Error retrieving updated player data.',
          ephemeral: true
        });
        return;
      }

      // Generate map view
      const mapImageBuffer = await worldMapService.generateMapView(playerService);
      
      // Get location display info
      const locationDisplay = worldMapService.getLocationDisplay(Location.GATE);

      // Create standardized area embed
      const { embed, attachment, components } = await createAreaEmbed({
        player: updatedPlayer,
        title: `📍 ${locationDisplay.name}`,
        description: `You depart from the city and arrive at the gate...`,
        showMovement: true,  // Depart should show movement options since player can now explore
        showScavenge: false, // No scavenging at gate
        mapImageBuffer
      });

      // Add gate-specific information
      embed.addFields([
        {
          name: '🚪 Gate Area',
          value: 'You are at the gate to town. Use `/return` to enter the city (if the gate is open).',
          inline: false
        }
      ]);

      // Send followup with movement embed
      await interaction.followUp({ embeds: [embed], files: [attachment], components, ephemeral: true });

      // Send public message
      const publicEmbed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle(`${player.name} has departed from the city and heads out into the wasteland...`)
        .setTimestamp();

      await interaction.followUp({ embeds: [publicEmbed] });

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