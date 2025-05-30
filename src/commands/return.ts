import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { InventoryService } from '../models/inventory';
import { Location, PlayerStatus } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const cityService = new CityService();
const inventoryService = new InventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('return')
    .setDescription('Return to the city from the gate (only works at gate when gate is open)'),
    
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

      // Check if player is at the gate
      if (player.location !== Location.GATE) {
        let locationMessage = '';
        switch (player.location) {
          case Location.CITY:
            locationMessage = 'You are already in the safety of the city!';
            break;
          case Location.HOME:
            locationMessage = 'You are at home. Use the city interface to move around town.';
            break;
          case Location.WASTE:
          case Location.GREATER_WASTE:
            locationMessage = 'You must be at the gate to return to the city. Use `/move <direction>` to navigate to the gate first.';
            break;
          default:
            locationMessage = 'You cannot return to the city from this location.';
        }

        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Cannot Return')
          .setDescription(locationMessage);

        await interaction.reply({ embeds: [embed], ephemeral: true });
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
          content: '❌ The city gate is closed. You cannot enter the city. Wait for someone inside to open the gate.',
          ephemeral: true
        });
        return;
      }

      // Update player location to city (remove coordinates when in city)
      const success = await playerService.updatePlayerLocation(discordId, Location.CITY);
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to return to city. Please try again.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('<z_house> Returned to City')
        .setDescription(`${player.name} returns to the safety of the city!`)
        .addFields([
          { 
            name: '📍 Previous Location', 
            value: `🚪 Gate (${player.x}, ${player.y})`, 
            inline: true 
          },
          { 
            name: '📍 New Location', 
            value: '<z_house> City (Safe Zone)', 
            inline: true 
          },
          { 
            name: '✅ Status', 
            value: 'Safe from zombie attacks', 
            inline: true 
          }
        ])
        .addFields([
          {
            name: '🛡️ Journey',
            value: 'You pass through the gate and enter the safety of the city walls.',
            inline: false
          }
        ])
        .addFields([
          {
            name: '🎮 What\'s Next?',
            value: '• Use `/depart` to venture out again\n• Use `/build` to help construct defenses\n• Use `/inventory` to check your items\n• Use `/bank` to access the town bank\n• Use `/status` to check your condition\n• Use `/gate` to control the city gate',
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