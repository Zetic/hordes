import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { WorldMapService } from '../services/worldMap';
import { PlayerStatus, Location } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const worldMapService = WorldMapService.getInstance();

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
      
      // Player status display
      const statusEmojis = {
        [PlayerStatus.HEALTHY]: '💚',
        [PlayerStatus.WOUNDED]: '🩸',
        [PlayerStatus.DEAD]: '💀',
        [PlayerStatus.REFRESHED]: '💧',
        [PlayerStatus.FED]: '🍞',
        [PlayerStatus.THIRSTY]: '🫗',
        [PlayerStatus.DEHYDRATED]: '🏜️',
        [PlayerStatus.EXHAUSTED]: '😴'
      };
      const statusTexts = {
        [PlayerStatus.HEALTHY]: 'Healthy',
        [PlayerStatus.WOUNDED]: 'Wounded',
        [PlayerStatus.DEAD]: 'Dead',
        [PlayerStatus.REFRESHED]: 'Refreshed',
        [PlayerStatus.FED]: 'Fed',
        [PlayerStatus.THIRSTY]: 'Thirsty',
        [PlayerStatus.DEHYDRATED]: 'Dehydrated',
        [PlayerStatus.EXHAUSTED]: 'Exhausted'
      };
      
      // Location display
      const locationDisplay = worldMapService.getLocationDisplay(player.location);
      
      const locationNames = {
        [Location.CITY]: 'City (Safe Zone)',
        [Location.WASTE]: 'Waste (Dangerous)',
        [Location.GATE]: 'Gate',
        [Location.HOME]: 'Home',
        [Location.GREATER_WASTE]: 'Greater Waste (Very Dangerous)',
        [Location.FACTORY]: 'Factory (Higher tier building materials)',
        [Location.ABANDONED_MANSION]: 'Abandoned Mansion (Generic lower quality supplies)',
        [Location.MODEST_NEIGHBORHOOD]: 'Modest Neighborhood (Generic home supplies)',
        [Location.GATED_COMMUNITY]: 'Gated Community (Higher value supplies)',
        [Location.CONVENIENCE_STORE]: 'Convenience Store Street (Convenience store supplies)',
        [Location.OFFICE_DISTRICT]: 'Office District (Technical supplies)',
        [Location.HOSPITAL]: 'Hospital (Medical Supplies)',
        [Location.SCHOOL_CAMPUS]: 'School Campus (Niche supplies)',
        [Location.SHOPPING_MALL]: 'Shopping Mall (Equipment and useful supplies)',
        [Location.HOTEL]: 'Hotel (Generic/Technical supplies)',
        [Location.CITY_PARK]: 'City Park (Generic/natural supplies)',
        [Location.AMUSEMENT_PARK]: 'Amusement Park (Technical supplies)',
        [Location.CONSTRUCTION_SITE]: 'Construction Site (Building materials)',
        [Location.RADIO_TOWER]: 'Radio Tower (Technical supplies)',
        [Location.CAMP_GROUNDS]: 'Camp Grounds (Generic/natural supplies)',
        [Location.LAKE_SIDE]: 'Lake Side (Natural supplies)'
      };

      const embed = new EmbedBuilder()
        .setColor(player.isAlive ? '#4ecdc4' : '#ff6b6b')
        .setTitle(`${statusEmojis[player.status]} ${player.name}'s Status`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields([
          { 
            name: '💚 Status', 
            value: `${statusEmojis[player.status]} ${statusTexts[player.status]}`, 
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
            value: `${locationDisplay.emoji} ${locationNames[player.location] || locationDisplay.name}${player.x !== null && player.y !== null ? ` (${player.x}, ${player.y})` : ''}`, 
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
        if (player.status === PlayerStatus.WOUNDED) warnings.push('🩸 You are wounded! Another injury could be fatal.');
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