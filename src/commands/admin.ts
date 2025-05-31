import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { WorldMapService } from '../services/worldMap';
import { Location, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const worldMapService = WorldMapService.getInstance();

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
          { name: 'refresh', value: 'refresh' },
          { name: 'hordesize', value: 'hordesize' },
          { name: 'revive', value: 'revive' },
          { name: 'respawn', value: 'respawn' },
          { name: 'return', value: 'return' }
        )
    )
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Admin password')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Target user (required for refresh and revive commands)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('value')
        .setDescription('Value (required for hordesize command)')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const command = interaction.options.get('command')?.value as string;
      const password = interaction.options.get('password')?.value as string;
      const targetUser = interaction.options.get('user')?.user;
      const value = interaction.options.get('value')?.value as number;

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
        case 'hordesize':
          await handleHordeSizeCommand(interaction, value);
          break;
        case 'revive':
          await handleReviveCommand(interaction, targetUser);
          break;
        case 'respawn':
          await handleRespawnCommand(interaction, targetUser);
          break;
        case 'return':
          await handleReturnCommand(interaction, targetUser);
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
  
  // Also reset the map to initial state
  if (success) {
    worldMapService.resetMap();
  }
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🔄 Complete World Reset' : '❌ Reset Failed')
    .setDescription(success 
      ? 'The entire world has been reset to its initial state. All players have been revived and restored to healthy status with full action points. The map has been reset and players will need to re-explore areas. All player data remains but locations have been reset.'
      : 'Failed to reset the world. Check the server logs for details.'
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
      ? 'A horde attack has been manually triggered. The results have been applied as if the horde phase just ended. The day has been advanced by 1.'
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

async function handleHordeSizeCommand(interaction: CommandInteraction, value: number | undefined) {
  if (value === undefined) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing Value')
      .setDescription('You must specify a value for the hordesize command.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (value < 1) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Invalid Value')
      .setDescription('Horde size must be at least 1.');
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.setHordeSize(value);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🧟‍♂️ Horde Size Updated' : '❌ Update Failed')
    .setDescription(success 
      ? `Horde size has been set to ${value}.`
      : 'Failed to update horde size. Check the server logs for details.'
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleReviveCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the revive command.');
    
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

  if (player.isAlive) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Player Already Alive')
      .setDescription(`${targetUser.username} is already alive.`);
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const success = await gameEngine.revivePlayer(targetUser.id);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '⚕️ Player Revived' : '❌ Revival Failed')
    .setDescription(success 
      ? `${targetUser.username} has been revived and returned to the city with healthy status.`
      : `Failed to revive ${targetUser.username}. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRespawnCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the respawn command.');
    
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

  // Perform a full reset for the individual player
  try {
    // Reset player to healthy state with full action points and return to city
    await playerService.updatePlayerHealth(targetUser.id, player.maxHealth);
    await playerService.updatePlayerStatus(targetUser.id, PlayerStatus.HEALTHY);
    await playerService.updatePlayerLocation(targetUser.id, Location.CITY);
    await playerService.resetPlayerActionPoints(targetUser.id);

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('🔄 Player Respawned')
      .setDescription(`${targetUser.username} has been fully reset - returned to city with healthy status, full health, and maximum action points.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error respawning player:', error);
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Respawn Failed')
      .setDescription(`Failed to respawn ${targetUser.username}. Check the server logs for details.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleReturnCommand(interaction: CommandInteraction, targetUser: any) {
  if (!targetUser) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Missing User')
      .setDescription('You must specify a user for the return command.');
    
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

  // Return player to town safely (without healing)
  const success = await playerService.updatePlayerLocation(targetUser.id, Location.CITY);
  
  const embed = new EmbedBuilder()
    .setColor(success ? '#4ecdc4' : '#ff6b6b')
    .setTitle(success ? '🏠 Player Returned to Town' : '❌ Return Failed')
    .setDescription(success 
      ? `${targetUser.username} has been safely returned to the town. Status and health remain unchanged.`
      : `Failed to return ${targetUser.username} to town. Check the server logs for details.`
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}