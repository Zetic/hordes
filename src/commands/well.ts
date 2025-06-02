import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';

const playerService = new PlayerService();
const cityService = new CityService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('well')
    .setDescription('Visit the town well to get water rations'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Visit Well')
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
          .setTitle('Cannot Visit Well')
          .setDescription('You must be in the city to visit the well. Use `/return` to go back to the city first.');

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

      await this.visitWell(interaction, player, city.id);

    } catch (error) {
      console.error('Error in well command:', error);
      await interaction.reply({
        content: '❌ An error occurred while visiting the well.',
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
  }
};