import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { CityService } from '../models/city';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { Location } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const cityService = new CityService();
const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Main game menu - navigate to different areas and actions'),
    
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

      // Check if player is in town
      if (player.location !== Location.CITY) {
        // If player is outside, show map view instead of error message
        const mapCommand = require('./map');
        await mapCommand.execute(interaction);
        return;
      }

      // Get city and game state (same logic as town command)
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

      // Count buildings by type and calculate total defense (same as town command)
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
        .setDescription('Survivor settlement status and navigation hub')
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

      // Buildings section (same as town command)
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
            value: 'No buildings constructed yet.\nUse the Build button below to see available construction projects!', 
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

      embed.setTimestamp();

      // Create navigation buttons
      const navRow1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('nav_bag')
            .setLabel('🎒 Bag')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_status')
            .setLabel('📊 Status')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_bank')
            .setLabel('🏦 Bank')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_build')
            .setLabel('🔨 Build')
            .setStyle(ButtonStyle.Primary)
        );

      const navRow2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('nav_craft')
            .setLabel('⚒️ Craft')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_gate')
            .setLabel('🚪 Gate')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_well')
            .setLabel('💧 Well')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('nav_tower')
            .setLabel('🗼 Tower')
            .setStyle(ButtonStyle.Primary)
        );

      await interaction.reply({ 
        embeds: [embed], 
        components: [navRow1, navRow2],
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error in play command:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading the main menu.',
        ephemeral: true
      });
    }
  }
};