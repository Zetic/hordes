import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands for testing purposes (requires password)')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Admin command to execute')
        .setRequired(true)
        .addChoices(
          { name: 'reset', value: 'reset' },
          { name: 'horde', value: 'horde' },
          { name: 'refresh', value: 'refresh' }
        )
    )
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Admin password')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target user (required for refresh command)')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const command = interaction.options.get('command')?.value as string;
      const password = interaction.options.get('password')?.value as string;
      const targetUser = interaction.options.get('user')?.user;

      // Validate admin password
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Admin Commands Disabled')
          .setDescription('Admin password is not configured in the environment.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (password !== adminPassword) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🔐 Access Denied')
          .setDescription('Invalid admin password.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Execute admin command
      switch (command) {
        case 'reset':
          await handleResetCommand(interaction);
          break;
        case 'horde':
          await handleHordeCommand(interaction);
          break;
        case 'refresh':
          await handleRefreshCommand(interaction, targetUser);
          break;
        default:
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Invalid Command')
            .setDescription('Unknown admin command.');
          
          await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      console.error('Error in admin command:', error);
      await interaction.reply({
        content: '❌ An error occurred while executing the admin command.',
        ephemeral: true
      });
    }
  }
};

async function handleResetCommand(interaction: CommandInteraction) {
  const success = await gameEngine.resetTown();
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🔄 Town Reset' : '❌ Reset Failed')
    .setDescription(success 
      ? 'The town has been reset to its initial state. All players have been revived and restored to full health and action points.'
      : 'Failed to reset the town. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHordeCommand(interaction: CommandInteraction) {
  const success = await gameEngine.triggerHordeResults();
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#ff9f43' : '#ff6b6b')
    .setTitle(success ? '🧟‍♂️ Horde Attack Triggered' : '❌ Horde Attack Failed')
    .setDescription(success 
      ? 'A horde attack has been manually triggered. The results have been applied as if the horde phase just ended.'
      : 'Failed to trigger horde attack. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRefreshCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the refresh command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const player = await playerService.getPlayer(targetUser.id);
  if (!player) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Not Found')
      .setDescription(`Player ${targetUser.username} is not registered in the game.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.refreshPlayerActionPoints(targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '⚡ Action Points Refreshed' : '❌ Refresh Failed')
    .setDescription(success 
      ? `${targetUser.username}'s action points have been refreshed to maximum.`
      : `Failed to refresh action points for ${targetUser.username}. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}