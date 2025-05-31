import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CityService } from '../models/city';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';

// IMPORTANT: No emojis must be added to any part of a command

const cityService = new CityService();
const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('town')
    .setDescription('View information about your town and its defenses'),
    
  async execute(interaction: CommandInteraction) {
    try {
      console.log(`🏙️ Town command initiated by ${interaction.user.id}`);
      // Defer reply since we're about to do database operations that might take time
      await interaction.deferReply();

      // Get city and game state
      console.log('📊 Fetching city and game state...');
      const city = await cityService.getDefaultCity();
      const gameState = await gameEngine.getCurrentGameState();
      
      // Check if we're in offline mode
      const isOfflineMode = gameState?.cityId === 'offline-city';
      
      if (!city && !isOfflineMode) {
        console.error('❌ No city found for town command');
        await interaction.editReply({
          content: '❌ No city found. Please contact an administrator.'
        });
        return;
      }

      if (isOfflineMode) {
        console.log('⚠️ Town command running in offline mode');
        await interaction.editReply({
          content: '⚠️ **Limited Functionality Mode**\n\nThe game is currently running in offline mode due to database connectivity issues. Most commands are not available. Please contact an administrator to restore full functionality.'
        });
        return;
      }

      const alivePlayers = await playerService.getAlivePlayers();

      console.log('✅ City data retrieved successfully');
      console.log(`📊 Game state available: ${gameState ? 'Yes' : 'No'}`);
      console.log(`👥 Alive players: ${alivePlayers?.length || 0}`);

      // At this point, city is guaranteed to not be null due to the earlier check
      const safeCity = city!;

      // Count buildings by type
      const buildingCounts = {
        watchtower: 0,
        wall: 0,
        workshop: 0,
        well: 0,
        hospital: 0
      };

      safeCity.buildings.forEach(building => {
        if (buildingCounts.hasOwnProperty(building.type)) {
          buildingCounts[building.type as keyof typeof buildingCounts]++;
        }
      });

      // Calculate defense level
      const totalDefense = buildingCounts.watchtower * 2 + buildingCounts.wall * 1;
      
      // Game phase info
      const phaseEmoji = gameState?.currentPhase === 'play_mode' ? '🌅' : '🌙';
      const phaseName = gameState?.currentPhase === 'play_mode' ? 'Play Mode' : 'Horde Mode';
      const phaseDescription = gameState?.currentPhase === 'play_mode' 
        ? 'Players can take actions'
        : 'Zombie attack in progress';

      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle(`🏙️ ${safeCity.name}`)
        .setDescription('Survivor settlement status and defenses')
        .addFields([
          { 
            name: '👥 Population', 
            value: `${alivePlayers.length} survivors`, 
            inline: true 
          },
          { 
            name: '📅 Day', 
            value: `${gameState?.currentDay || safeCity.day}`, 
            inline: true 
          },
          { 
            name: '🛡️ Defense Level', 
            value: `${totalDefense}`, 
            inline: true 
          },
          { 
            name: '🎮 Current Phase', 
            value: `${phaseEmoji} ${phaseName}\n${phaseDescription}`, 
            inline: false 
          }
        ]);

      // Buildings section
      const buildingsInfo = [];
      if (buildingCounts.watchtower > 0) buildingsInfo.push(`🗼 ${buildingCounts.watchtower}x Watchtower`);
      if (buildingCounts.wall > 0) buildingsInfo.push(`🧱 ${buildingCounts.wall}x Wall`);
      if (buildingCounts.workshop > 0) buildingsInfo.push(`🔨 ${buildingCounts.workshop}x Workshop`);
      if (buildingCounts.well > 0) buildingsInfo.push(`💧 ${buildingCounts.well}x Well`);
      if (buildingCounts.hospital > 0) buildingsInfo.push(`🏥 ${buildingCounts.hospital}x Hospital`);

      if (buildingsInfo.length > 0) {
        embed.addFields([
          { 
            name: '🏗️ Buildings', 
            value: buildingsInfo.join('\n'), 
            inline: false 
          }
        ]);
      } else {
        embed.addFields([
          { 
            name: '🏗️ Buildings', 
            value: 'No buildings constructed yet.\nUse `/build` to start construction!', 
            inline: false 
          }
        ]);
      }

      // Add schedule info
      embed.addFields([
        {
          name: '⏰ Daily Schedule',
          value: '🌅 **Play Mode**: 9:00 PM - 7:59 PM (next day)\n🌙 **Horde Mode**: 8:00 PM - 8:59 PM',
          inline: false
        }
      ]);

      // Add next phase change if available
      if (gameState?.nextPhaseChange) {
        embed.addFields([
          {
            name: '⏰ Next Phase Change',
            value: `<t:${Math.floor(gameState.nextPhaseChange.getTime() / 1000)}:R>`,
            inline: true
          }
        ]);
      }

      // Add survival tips
      const tips = [
        '💡 Build watchtowers and walls to increase defense',
        '💧 Wells provide water for the community',
        '🏥 Hospitals help heal wounded survivors',
        '🔨 Workshops enable advanced crafting',
        '🤝 Work together to survive longer!'
      ];
      
      embed.addFields([
        {
          name: '💡 Survival Tips',
          value: tips.join('\n'),
          inline: false
        }
      ]);

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in town command:', error);
      
      // Check if reply was already deferred
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred while getting city information.'
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred while getting city information.',
          ephemeral: true
        });
      }
    }
  }
};