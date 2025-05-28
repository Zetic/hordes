import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check your current status and stats')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('Check another player\'s status')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const targetUser = interaction.options.get('player')?.user || interaction.user;
      const discordId = targetUser.id;
      const isOwnStatus = discordId === interaction.user.id;

      // Get player data
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('👻 Player Not Found')
          .setDescription(isOwnStatus 
            ? 'You haven\'t joined the game yet! Use `/join` to start surviving.'
            : `${targetUser.displayName} hasn't joined the game yet.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get game state
      const gameState = await gameEngine.getCurrentGameState();
      
      // Determine status emoji and text
      const statusEmoji = player.isAlive ? '💚' : '💀';
      const statusText = player.isAlive ? 'Alive' : 'Dead';
      const healthEmoji = player.health > 70 ? '💚' : player.health > 30 ? '💛' : '❤️';
      
      // Location display
      const locationEmojis = {
        city: '🏠',
        outside: '🌲',
        home: '🏡',
        greater_outside: '🌍'
      };
      const locationNames = {
        city: 'City (Safe Zone)',
        outside: 'Outside (Dangerous)',
        home: 'Home',
        greater_outside: 'Greater Outside (Very Dangerous)'
      };

      const embed = new EmbedBuilder()
        .setColor(player.isAlive ? '#4ecdc4' : '#ff6b6b')
        .setTitle(`${statusEmoji} ${player.name}'s Status`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields([
          { 
            name: '💚 Health', 
            value: `${healthEmoji} ${player.health}/${player.maxHealth}`, 
            inline: true 
          },
          { 
            name: '⚡ Action Points', 
            value: `${player.actionPoints}/${player.maxActionPoints}`, 
            inline: true 
          },
          { 
            name: '💧 Water', 
            value: `${player.water} days`, 
            inline: true 
          },
          { 
            name: '📍 Location', 
            value: `${locationEmojis[player.location]} ${locationNames[player.location]}`, 
            inline: true 
          },
          { 
            name: '🎯 Status', 
            value: statusText, 
            inline: true 
          },
          { 
            name: '⏰ Last Action', 
            value: `<t:${Math.floor(player.lastActionTime.getTime() / 1000)}:R>`, 
            inline: true 
          }
        ]);

      // Add game info if it's the player's own status
      if (isOwnStatus && gameState) {
        const phaseEmoji = gameState.currentPhase === 'play_mode' ? '🌅' : '🌙';
        const phaseName = gameState.currentPhase === 'play_mode' ? 'Play Mode' : 'Horde Mode';
        
        embed.addFields([
          { name: '\u200B', value: '\u200B', inline: false },
          { 
            name: '🎮 Game Status', 
            value: `**Day ${gameState.currentDay}** • ${phaseEmoji} ${phaseName}`, 
            inline: true 
          },
          { 
            name: '⏰ Next Phase', 
            value: `<t:${Math.floor(gameState.nextPhaseChange.getTime() / 1000)}:R>`, 
            inline: true 
          }
        ]);

        // Add warnings
        const warnings = [];
        if (player.health <= 30) warnings.push('⚠️ Low health!');
        if (player.water <= 1) warnings.push('🚨 Running out of water!');
        if (player.actionPoints <= 2) warnings.push('💤 Low action points');
        
        if (warnings.length > 0) {
          embed.addFields([
            { name: '⚠️ Warnings', value: warnings.join('\n') }
          ]);
        }
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: isOwnStatus });

    } catch (error) {
      console.error('Error in status command:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking status.',
        ephemeral: true
      });
    }
  }
};