import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { PlayerService } from '../models/player';
import { WorldMapService } from '../services/worldMap';
import { Location } from '../types/game';
import { createAreaEmbed } from '../utils/embedUtils';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const worldMapService = WorldMapService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Display the current area without moving or using energy'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: 'Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in a location that can be viewed
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: 'You are in a safe location. Use `/depart` to venture outside where you can explore areas.',
          ephemeral: true
        });
        return;
      }

      // Check if player has valid coordinates
      if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
        await interaction.reply({
          content: 'Invalid position. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Defer reply since we're about to do expensive operations (map generation)
      await interaction.deferReply({ ephemeral: true });

      // Generate map view
      const mapImageBuffer = await worldMapService.generateMapView(playerService);
      
      // Create standardized area embed
      const { embed, attachment, components } = await createAreaEmbed({
        player,
        title: 'Current Area View',
        description: `${player.name} surveys the surrounding area...`,
        showMovement: true,  // Map command should show movement buttons for exploration
        showScavenge: true,  // Show scavenge button if available
        mapImageBuffer
      });

      // Add location-specific information for gate
      if (player.location === Location.GATE) {
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
      console.error('Error in area command:', error);
      
      // Check if reply was already deferred
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while viewing the area.'
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while viewing the area.',
          ephemeral: true
        });
      }
    }
  }
};