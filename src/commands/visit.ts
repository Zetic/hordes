import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CityService } from '../models/city';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';

const cityService = new CityService();
const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('visit')
    .setDescription('View information about visitable buildings in the town'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Check if player can perform action (0 AP required for visiting buildings)
      const actionCheck = await gameEngine.canPerformAction(discordId, 0);
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

      // Show available buildings and their dedicated commands
      const embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('🏛️ Town Buildings')
        .setDescription('Here are the buildings available in town. Each building now has its own dedicated command for better access.');

      const buildingsList = [];
      
      // Always available buildings
      buildingsList.push('💧 **Well** - Use `/well` to get water rations');
      
      // Buildings that need to be constructed
      const hasWorkshop = visitableBuildings.some(b => b.type === 'workshop');
      if (hasWorkshop) {
        buildingsList.push('🔨 **Workshop** - Use `/craft` to convert resources');
      }
      
      const hasWatchTower = visitableBuildings.some(b => b.type === 'watch_tower');
      if (hasWatchTower) {
        buildingsList.push('🗼 **Watch Tower** - Use `/tower` to observe horde activity');
      }

      if (buildingsList.length === 0) {
        embed.setDescription('No buildings are currently available. Complete construction projects to unlock more buildings!');
      } else {
        embed.addFields([{
          name: '🏠 Available Buildings',
          value: buildingsList.join('\n'),
          inline: false
        }]);
        
        embed.addFields([{
          name: '💡 How to Use',
          value: 'Buildings now have dedicated commands:\n• `/well` - Visit the well\n• `/craft` - Use the workshop\n• `/tower` - Visit the watch tower',
          inline: false
        }]);
      }

      // Show construction projects if any buildings are missing
      if (!hasWorkshop || !hasWatchTower) {
        const missingBuildings = [];
        if (!hasWorkshop) missingBuildings.push('🔨 Workshop');
        if (!hasWatchTower) missingBuildings.push('🗼 Watch Tower');
        
        embed.addFields([{
          name: '🚧 Buildings Under Construction',
          value: `Use \`/build\` to help construct: ${missingBuildings.join(', ')}`,
          inline: false
        }]);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in visit command:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking buildings.',
        ephemeral: true
      });
    }
  }
};