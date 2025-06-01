import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { CityService } from '../models/city';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';

const cityService = new CityService();
const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('visit')
    .setDescription('Visit buildings in the town')
    .addStringOption(option =>
      option.setName('building')
        .setDescription('The building to visit')
        .setRequired(false)
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const buildingName = interaction.options.get('building')?.value as string;

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Visit Buildings')
          .setDescription(actionCheck.reason || 'Unknown error');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in the city
      if (player.location !== 'city') {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Visit Buildings')
          .setDescription('You must be in the city to visit buildings. Use `/return` to go back to the city first.');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get city
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ No city found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Get all visitable buildings
      const allBuildings = await cityService.getCityBuildings(city.id);
      const visitableBuildings = allBuildings.filter(building => building.isVisitable);

      // Always include the well (even if not built as a project, it exists from start)
      const hasWell = true; // The well is always available from the start
      const hasWorkshop = visitableBuildings.some(b => b.type === 'workshop');
      const hasWatchTower = visitableBuildings.some(b => b.type === 'watch_tower');

      // If no building specified, show available buildings
      if (!buildingName) {
        const embed = new EmbedBuilder()
          .setColor('#45b7d1')
          .setTitle('🏛️ Visitable Buildings')
          .setDescription('Choose a building to visit. Use `/visit [building_name]` to visit a specific building.');

        const buildingsList = [];
        if (hasWell) buildingsList.push('💧 **Well** - Take daily water rations');
        if (hasWorkshop) buildingsList.push('🔨 **Workshop** - Convert resources and combine items');
        if (hasWatchTower) buildingsList.push('🗼 **Watch Tower** - Get horde size estimates');

        if (buildingsList.length === 0) {
          embed.setDescription('No buildings are currently available to visit. Complete construction projects to unlock visitable buildings!');
        } else {
          embed.addFields([{
            name: '🚪 Available Buildings',
            value: buildingsList.join('\n'),
            inline: false
          }]);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Handle specific building visits
      const lowerBuildingName = buildingName.toLowerCase();

      if (lowerBuildingName.includes('well')) {
        await this.visitWell(interaction, player, city.id);
      } else if (lowerBuildingName.includes('workshop')) {
        if (!hasWorkshop) {
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Workshop Not Available')
            .setDescription('The Workshop has not been built yet. Complete the Workshop construction project first.');
          
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        await this.visitWorkshop(interaction, player);
      } else if (lowerBuildingName.includes('watch') || lowerBuildingName.includes('tower')) {
        if (!hasWatchTower) {
          const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Watch Tower Not Available')
            .setDescription('The Watch Tower has not been built yet. Complete the Watch Tower construction project first.');
          
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        await this.visitWatchTower(interaction, player, city.id);
      } else {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Building Not Found')
          .setDescription(`Building "${buildingName}" not found or is not visitable. Use \`/visit\` without arguments to see available buildings.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

    } catch (error) {
      console.error('Error in visit command:', error);
      await interaction.reply({
        content: '❌ An error occurred while visiting the building.',
        ephemeral: true
      });
    }
  },

  async visitWell(interaction: CommandInteraction, player: any, cityId: string) {
    // Initialize well if needed
    await constructionService.initializeWell(cityId);
    
    // Get well water info
    const wellWater = await constructionService.getWellWater(cityId);
    if (!wellWater) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Well Error')
        .setDescription('Unable to access well information.');
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Check if player has already taken water today
    const today = new Date().toISOString().split('T')[0];
    const { success: canTake, message, rationsTaken } = await constructionService.takeWaterRation(player.id, cityId);

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('💧 Town Well')
      .setDescription('The town\'s water source. Clean, fresh water is available for all survivors.')
      .addFields([
        {
          name: '💧 Water Available',
          value: `${wellWater.currentWater} rations`,
          inline: true
        },
        {
          name: '🚰 Daily Limit',
          value: 'You can take 1 ration per day', // TODO: Update this based on pump
          inline: true
        },
        {
          name: '📅 Today\'s Usage',
          value: `You have taken ${rationsTaken} ration(s) today`,
          inline: true
        }
      ]);

    // Create take water button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('take_water_ration')
          .setLabel('💧 Take Water Ration')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(wellWater.currentWater <= 0)
      );

    if (wellWater.currentWater <= 0) {
      embed.addFields([{
        name: '⚠️ No Water Available',
        value: 'The well is currently empty. Wait for it to refill or for someone to build a pump.',
        inline: false
      }]);
    } else {
      embed.addFields([{
        name: '💧 Fresh Water',
        value: 'Press the button below to take a water ration if you haven\'t already taken your daily allowance.',
        inline: false
      }]);
    }

    await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      ephemeral: true 
    });
  },

  async visitWorkshop(interaction: CommandInteraction, player: any) {
    const embed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle('🔨 Workshop')
      .setDescription('A place to convert resources and combine items into more useful materials.')
      .addFields([
        {
          name: '⚙️ Available Recipes',
          value: 'Select a recipe from the dropdown below to see details and craft.',
          inline: false
        },
        {
          name: '⚡ Crafting Cost',
          value: 'Each conversion costs 3 Action Points',
          inline: true
        },
        {
          name: '🔄 Current Recipes',
          value: '• Rotten Log → Twisted Plank\n• Scrap Metal → Wrought Metal',
          inline: false
        }
      ]);

    // Create recipe selection dropdown
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('workshop_recipe_select')
      .setPlaceholder('Choose a recipe to craft...')
      .addOptions([
        {
          label: 'Rotten Log → Twisted Plank',
          description: 'Convert Rotten Log into useful Twisted Plank',
          value: 'rotten_log_to_twisted_plank'
        },
        {
          label: 'Scrap Metal → Wrought Metal',
          description: 'Convert Scrap Metal into sturdy Wrought Metal',
          value: 'scrap_metal_to_wrought_metal'
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      ephemeral: true 
    });
  },

  async visitWatchTower(interaction: CommandInteraction, player: any, cityId: string) {
    // TODO: Implement horde size estimation system
    // For now, show a placeholder
    const embed = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle('🗼 Watch Tower')
      .setDescription('From this elevated position, you can observe the surrounding wasteland and estimate the size of approaching hordes.')
      .addFields([
        {
          name: '👁️ Horde Size Estimate',
          value: 'Scanning the horizon for zombie activity...',
          inline: false
        },
        {
          name: '📊 Estimate Accuracy',
          value: 'Visit more often to improve accuracy (12 visits for 100% accuracy)',
          inline: false
        }
      ]);

    // Create observation button
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('observe_horde')
          .setLabel('🔭 Observe Horde Activity')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      ephemeral: true 
    });
  }
};