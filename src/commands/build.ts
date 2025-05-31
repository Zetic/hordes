import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CityService } from '../models/city';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { BuildingType } from '../types/game';

const cityService = new CityService();
const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('build')
    .setDescription('Construct buildings to defend the city')
    .addStringOption(option =>
      option.setName('building')
        .setDescription('Type of building to construct')
        .setRequired(true)
        .addChoices(
          { name: '🗼 Watchtower (+2 defense)', value: 'watchtower' },
          { name: '🧱 Wall (+1 defense)', value: 'wall' },
          { name: '🔨 Workshop (crafting)', value: 'workshop' },
          { name: '💧 Well (water source)', value: 'well' },
          { name: '🏥 Hospital (healing)', value: 'hospital' }
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const buildingType = interaction.options.get('building')?.value as string;

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Build')
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
          .setTitle('Cannot Build')
          .setDescription('You must be in the city to construct buildings. Use `/return` to go back to the city first.');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Building costs and requirements
      const buildingInfo = {
        watchtower: { name: '🗼 Watchtower', cost: 3, description: 'Provides +2 defense against zombie attacks' },
        wall: { name: '🧱 Wall', cost: 2, description: 'Provides +1 defense against zombie attacks' },
        workshop: { name: '🔨 Workshop', cost: 2, description: 'Enables advanced crafting recipes' },
        well: { name: '💧 Well', cost: 2, description: 'Provides daily water for survivors' },
        hospital: { name: '🏥 Hospital', cost: 3, description: 'Heals wounded survivors' }
      };

      const building = buildingInfo[buildingType as keyof typeof buildingInfo];
      if (!building) {
        await interaction.reply({
          content: '❌ Invalid building type.',
          ephemeral: true
        });
        return;
      }

      // Check action points
      if (player.actionPoints < building.cost) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Insufficient Action Points')
          .setDescription(`Building a ${building.name} requires ${building.cost} action points.\nYou currently have ${player.actionPoints} action points.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Spend action points
      const success = await playerService.spendActionPoints(discordId, building.cost);
      if (!success) {
        await interaction.reply({
          content: '❌ Failed to spend action points. Please try again.',
          ephemeral: true
        });
        return;
      }

      // Get city and add building
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ No city found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      const newBuilding = await cityService.addBuilding(city.id, buildingType as BuildingType);
      if (!newBuilding) {
        await interaction.reply({
          content: '❌ Failed to construct building. Please try again.',
          ephemeral: true
        });
        return;
      }

      // Calculate new defense level
      const buildings = await cityService.getCityBuildings(city.id);
      const totalDefense = buildings.reduce((total, b) => {
        return total + (b.type === 'watchtower' ? 2 : b.type === 'wall' ? 1 : 0);
      }, 0);

      const embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('🏗️ Building Constructed!')
        .setDescription(`${player.name} has successfully built a ${building.name}!`)
        .addFields([
          { 
            name: '🏗️ Building', 
            value: `${building.name}\n${building.description}`, 
            inline: true 
          },
          { 
            name: '⚡ Action Points Used', 
            value: `${building.cost}`, 
            inline: true 
          },
          { 
            name: '🛡️ City Defense', 
            value: `${totalDefense}`, 
            inline: true 
          }
        ]);

      // Add special effects based on building type
      if (buildingType === 'watchtower') {
        embed.addFields([
          { 
            name: '🗼 Watchtower Effect', 
            value: 'Early warning system active! +2 defense against horde attacks.', 
            inline: false 
          }
        ]);
      } else if (buildingType === 'wall') {
        embed.addFields([
          { 
            name: '🧱 Wall Effect', 
            value: 'Physical barrier reinforced! +1 defense against horde attacks.', 
            inline: false 
          }
        ]);
      } else if (buildingType === 'hospital') {
        embed.addFields([
          { 
            name: '🏥 Hospital Effect', 
            value: 'Medical facilities available! Wounded survivors can now receive better treatment.', 
            inline: false 
          }
        ]);
      } else if (buildingType === 'well') {
        embed.addFields([
          { 
            name: '💧 Well Effect', 
            value: 'Fresh water source secured! Reduces daily water consumption risk.', 
            inline: false 
          }
        ]);
      } else if (buildingType === 'workshop') {
        embed.addFields([
          { 
            name: '🔨 Workshop Effect', 
            value: 'Advanced crafting enabled! More powerful items can now be created.', 
            inline: false 
          }
        ]);
      }

      embed.addFields([
        {
          name: '🤝 Teamwork',
          value: 'Your contribution helps the entire community survive! Keep building to increase our chances against the horde.',
          inline: false
        }
      ]);

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in build command:', error);
      await interaction.reply({
        content: '❌ An error occurred while building.',
        ephemeral: true
      });
    }
  }
};