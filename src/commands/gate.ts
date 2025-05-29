import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { GameEngine } from '../services/gameEngine';
import { Location, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const cityService = new CityService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gate')
    .setDescription('Check or control the city gate')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(false)
        .addChoices(
          { name: '🔓 Open the gate', value: 'open' },
          { name: '🔒 Close the gate', value: 'close' },
          { name: '👁️ Check gate status', value: 'status' }
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const action = interaction.options.get('action')?.value as string || 'status';

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Get city
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ City not found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Handle different actions
      if (action === 'status') {
        // Just show status - anyone can check
        const gateStatus = city.gateOpen ? 'Open' : 'Closed';
        const gateEmoji = city.gateOpen ? '🔓' : '🔒';
        const gateColor = city.gateOpen ? '#4ecdc4' : '#ff6b6b';

        const embed = new EmbedBuilder()
          .setColor(gateColor)
          .setTitle(`🚪 City Gate Status`)
          .setDescription(`The city gate is currently **${gateStatus}**.`)
          .addFields([
            { 
              name: '🚪 Gate Status', 
              value: `${gateEmoji} ${gateStatus}`, 
              inline: true 
            },
            { 
              name: '📍 Your Location', 
              value: player.location === Location.CITY ? '🏠 In City' : 
                     player.location === Location.HOME ? '🏡 At Home' :
                     player.location === Location.GATE ? '🚪 At Gate' :
                     `🌍 Outside (${player.x}, ${player.y})`, 
              inline: true 
            }
          ]);

        if (city.gateOpen) {
          embed.addFields([
            {
              name: '✅ Available Actions',
              value: '• Use `/depart` to leave town through the gate\n• Players outside can use `/return` at the gate',
              inline: false
            }
          ]);
        } else {
          embed.addFields([
            {
              name: '❌ Gate is Closed',
              value: '• Players cannot leave or enter the city\n• Use `/gate open` to open the gate (if in city)',
              inline: false
            }
          ]);
        }

        embed.setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      // For open/close actions, player must be in city
      if (player.location !== Location.CITY) {
        await interaction.reply({
          content: '❌ You must be in the city to control the gate.',
          ephemeral: true
        });
        return;
      }

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Control Gate')
          .setDescription(actionCheck.reason || 'Unknown error');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (action === 'open') {
        if (city.gateOpen) {
          await interaction.reply({
            content: '❌ The gate is already open.',
            ephemeral: true
          });
          return;
        }

        // Open the gate
        const success = await cityService.updateGateStatus(city.id, true);
        if (!success) {
          await interaction.reply({
            content: '❌ Failed to open the gate. Please try again.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#4ecdc4')
          .setTitle('🔓 Gate Opened')
          .setDescription(`${player.name} has opened the city gate!`)
          .addFields([
            { 
              name: '🚪 Gate Status', 
              value: '🔓 Open', 
              inline: true 
            },
            { 
              name: '✅ Effect', 
              value: 'Players can now leave and enter the city', 
              inline: true 
            }
          ])
          .addFields([
            {
              name: '📢 Announcement',
              value: 'The gate is now open! Citizens can use `/depart` to leave town.',
              inline: false
            }
          ])
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });

      } else if (action === 'close') {
        if (!city.gateOpen) {
          await interaction.reply({
            content: '❌ The gate is already closed.',
            ephemeral: true
          });
          return;
        }

        // Close the gate
        const success = await cityService.updateGateStatus(city.id, false);
        if (!success) {
          await interaction.reply({
            content: '❌ Failed to close the gate. Please try again.',
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🔒 Gate Closed')
          .setDescription(`${player.name} has closed the city gate!`)
          .addFields([
            { 
              name: '🚪 Gate Status', 
              value: '🔒 Closed', 
              inline: true 
            },
            { 
              name: '⚠️ Effect', 
              value: 'Players cannot leave or enter the city', 
              inline: true 
            }
          ])
          .addFields([
            {
              name: '📢 Announcement',
              value: 'The gate is now closed! No one can enter or leave the city.',
              inline: false
            }
          ])
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Error in gate command:', error);
      await interaction.reply({
        content: '❌ An error occurred while controlling the gate.',
        ephemeral: true
      });
    }
  }
};