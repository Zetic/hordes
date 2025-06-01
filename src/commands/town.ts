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
      // Get city and game state
      const city = await cityService.getDefaultCity();
      const gameState = await gameEngine.getCurrentGameState();
      const alivePlayers = await playerService.getAlivePlayers();

      if (!city) {
        await interaction.reply({
          content: '❌ No town exists yet! Someone needs to create a town first using `/create town <name>`.',
          ephemeral: true
        });
        return;
      }

      // Count buildings by type and calculate total defense
      const buildingCounts = {
        watchtower: 0,
        wall: 0,
        workshop: 0,
        well: 0,
        hospital: 0,
        defensive_wall: 0,
        pump: 0,
        watch_tower: 0,
        portal_lock: 0
      };

      let totalDefense = 0;

      city.buildings.forEach(building => {
        if (buildingCounts.hasOwnProperty(building.type)) {
          buildingCounts[building.type as keyof typeof buildingCounts]++;
        }
        
        // Add defense bonus from each building
        if (building.defenseBonus) {
          totalDefense += building.defenseBonus;
        } else {
          // Legacy building defense calculation for old buildings
          if (building.type === 'watchtower') totalDefense += 2;
          if (building.type === 'wall') totalDefense += 1;
        }
      });
      
      // Game phase info
      const phaseEmoji = gameState?.currentPhase === 'play_mode' ? '🌅' : '🌙';
      const phaseName = gameState?.currentPhase === 'play_mode' ? 'Play Mode' : 'Horde Mode';
      const phaseDescription = gameState?.currentPhase === 'play_mode' 
        ? 'Players can take actions'
        : 'Zombie attack in progress';

      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle(`🏙️ ${city.name}`)
        .setDescription('Survivor settlement status and defenses')
        .addFields([
          { 
            name: '👥 Population', 
            value: `${alivePlayers.length} survivors`, 
            inline: true 
          },
          { 
            name: '📅 Day', 
            value: `${gameState?.currentDay || city.day}`, 
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
      
      // Legacy buildings
      if (buildingCounts.watchtower > 0) buildingsInfo.push(`🗼 ${buildingCounts.watchtower}x Watchtower`);
      if (buildingCounts.wall > 0) buildingsInfo.push(`🧱 ${buildingCounts.wall}x Wall`);
      if (buildingCounts.workshop > 0) buildingsInfo.push(`🔨 ${buildingCounts.workshop}x Workshop`);
      if (buildingCounts.well > 0) buildingsInfo.push(`💧 ${buildingCounts.well}x Well`);
      if (buildingCounts.hospital > 0) buildingsInfo.push(`🏥 ${buildingCounts.hospital}x Hospital`);
      
      // New construction project buildings
      if (buildingCounts.defensive_wall > 0) buildingsInfo.push(`🛡️ ${buildingCounts.defensive_wall}x Defensive Wall`);
      if (buildingCounts.pump > 0) buildingsInfo.push(`⚙️ ${buildingCounts.pump}x Pump`);
      if (buildingCounts.watch_tower > 0) buildingsInfo.push(`🗼 ${buildingCounts.watch_tower}x Watch Tower`);
      if (buildingCounts.portal_lock > 0) buildingsInfo.push(`🚪 ${buildingCounts.portal_lock}x Portal Lock`);

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
            value: 'No buildings constructed yet.\nUse `/build` to see available construction projects!', 
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

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in town command:', error);
      await interaction.reply({
        content: '❌ An error occurred while getting city information.',
        ephemeral: true
      });
    }
  }
};