import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { Location, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('return')
    .setDescription('Return to the safety of the city'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      if (isEncumbered) {
        await interaction.reply({
          content: '❌ You are encumbered and cannot return to the city. Use `/drop <item>` to free up space first.',
          ephemeral: true
        });
        return;
      }

      // Check if player is already in the city
      if (player.location === Location.CITY) {
        const embed = new EmbedBuilder()
          .setColor('#4ecdc4')
          .setTitle('🏠 Already in City')
          .setDescription('You are already in the safety of the city!');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Update player location to city
      const success = await playerService.updatePlayerLocation(discordId, Location.CITY);
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to return to city. Please try again.',
          ephemeral: true
        });
        return;
      }

      // Generate return message based on previous location
      const locationMessages = {
        outside: 'You make your way back from the outside areas to the safety of the city walls.',
        greater_outside: 'After a long and dangerous journey, you finally return from the greater outside to the city.',
        home: 'You leave your home and join the other survivors in the city center.'
      };

      const message = locationMessages[player.location] || 'You return to the city.';

      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('🏠 Returned to City')
        .setDescription(`${player.name} has returned to safety!`)
        .addFields([
          { 
            name: '📍 Location', 
            value: '🏠 City (Safe Zone)', 
            inline: true 
          },
          { 
            name: '✅ Status', 
            value: 'Safe from zombie attacks', 
            inline: true 
          },
          { 
            name: '🛡️ Journey', 
            value: message, 
            inline: false 
          }
        ])
        .addFields([
          {
            name: '🎮 What\'s Next?',
            value: '• Use `/explore` to venture out again\n• Use `/build` to help construct defenses\n• Use `/inventory` to check your items\n• Use `/bank` to access the town bank\n• Use `/status` to check your condition\n• Use `/city-info` to see the town status',
            inline: false
          }
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in return command:', error);
      await interaction.reply({
        content: '❌ An error occurred while returning to the city.',
        ephemeral: true
      });
    }
  }
};