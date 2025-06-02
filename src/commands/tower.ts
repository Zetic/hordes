import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { GameEngine } from '../services/gameEngine';

const playerService = new PlayerService();
const cityService = new CityService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tower')
    .setDescription('Visit the watch tower to observe horde activity'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Check if player can perform action (0 AP required for visiting watch tower)
      const actionCheck = await gameEngine.canPerformAction(discordId, 0);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Visit Watch Tower')
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
          .setTitle('Cannot Visit Watch Tower')
          .setDescription('You must be in the city to visit the watch tower. Use `/return` to go back to the city first.');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get city and check if watch tower exists
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ No city found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      const allBuildings = await cityService.getCityBuildings(city.id);
      const hasWatchTower = allBuildings.some(b => b.type === 'watch_tower' && b.isVisitable);

      if (!hasWatchTower) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Watch Tower Not Available')
          .setDescription('The Watch Tower has not been built yet. Complete the Watch Tower construction project first.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await this.visitWatchTower(interaction, player, city.id);

    } catch (error) {
      console.error('Error in tower command:', error);
      await interaction.reply({
        content: '❌ An error occurred while visiting the watch tower.',
        ephemeral: true
      });
    }
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