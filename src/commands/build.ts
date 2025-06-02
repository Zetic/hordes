import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
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
    .setName('build')
    .setDescription('Work on construction projects to build new structures for the town')
    .addStringOption(option =>
      option.setName('project')
        .setDescription('The construction project to work on')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: any) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      
      if (focusedOption.name === 'project') {
        const discordId = interaction.user.id;
        
        // Get player
        const player = await playerService.getPlayer(discordId);
        if (!player || player.location !== 'city') {
          await interaction.respond([]);
          return;
        }

        // Get city
        const city = await cityService.getDefaultCity();
        if (!city) {
          await interaction.respond([]);
          return;
        }

        // Get available construction projects
        const projects = await constructionService.getAvailableProjects(city.id);
        
        // Filter projects based on what user is typing
        const filtered = projects
          .filter(project => 
            project.projectName.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
            project.projectType.toLowerCase().includes(focusedOption.value.toLowerCase())
          )
          .slice(0, 25) // Discord limits to 25 choices
          .map(project => ({
            name: `${project.projectName} (${project.currentApProgress}/${project.totalApRequired} AP)`,
            value: project.projectName
          }));

        await interaction.respond(filtered);
      }
    } catch (error) {
      console.error('Error in build command autocomplete:', error);
      await interaction.respond([]);
    }
  },
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const projectName = interaction.options.get('project')?.value as string;

      // Check if player can perform action (0 AP required for viewing build menu)
      const actionCheck = await gameEngine.canPerformAction(discordId, 0);
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
          .setDescription('You must be in the city to work on construction projects. Use `/return` to go back to the city first.');

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

      // Initialize default projects and well if needed
      await constructionService.initializeDefaultProjects(city.id);
      await constructionService.initializeWell(city.id);

      // Get available construction projects
      const projects = await constructionService.getAvailableProjects(city.id);
      
      if (projects.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#45b7d1')
          .setTitle('🏗️ Construction Projects')
          .setDescription('No construction projects are currently available. All projects may be completed!');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // If no specific project was specified, show available projects
      if (!projectName) {
        const embed = new EmbedBuilder()
          .setColor('#45b7d1')
          .setTitle('🏗️ Available Construction Projects')
          .setDescription('Choose a project to work on. Use `/build [project_name]` to select a specific project.')
          .addFields(
            projects.map(project => ({
              name: `${project.projectName} (${project.subCategory})`,
              value: `**Progress:** ${project.currentApProgress}/${project.totalApRequired} AP\n**Description:** ${project.description}`,
              inline: false
            }))
          );

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Find the specific project
      const project = projects.find(p => 
        p.projectName.toLowerCase().includes(projectName.toLowerCase()) ||
        p.projectType.toLowerCase() === projectName.toLowerCase()
      );

      if (!project) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Project Not Found')
          .setDescription(`Construction project "${projectName}" not found. Use \`/build\` without arguments to see available projects.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Check material requirements
      const materialCheck = await constructionService.checkMaterialRequirements(project.id, city.id);
      
      const embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle(`🏗️ ${project.projectName}`)
        .setDescription(project.description)
        .addFields([
          {
            name: '📊 Progress',
            value: `${project.currentApProgress}/${project.totalApRequired} AP`,
            inline: true
          },
          {
            name: '🏭 Category',
            value: `${project.category} > ${project.subCategory}`,
            inline: true
          },
          {
            name: '🔧 Materials Required',
            value: materialCheck.details.map(detail => 
              `${detail.itemName}: ${detail.available}/${detail.required} ${detail.available >= detail.required ? '✅' : '❌'}`
            ).join('\n') || 'No materials required',
            inline: false
          }
        ]);

      // Add special effects info
      if (project.defenseBonus > 0) {
        embed.addFields([{
          name: '🛡️ Defense Bonus',
          value: `+${project.defenseBonus} Defense`,
          inline: true
        }]);
      }

      if (project.isVisitable) {
        embed.addFields([{
          name: '🚪 Visitable',
          value: 'This building can be visited once completed',
          inline: true
        }]);
      }

      // Create build buttons
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      // Always add the 1 AP button
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`build_project_${project.id}`)
          .setLabel('🔨 Add 1 AP to Project')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(player.actionPoints < 1)
      );

      // Add 5 AP button if player has enough AP and project needs at least 5 AP
      const remainingAp = project.totalApRequired - project.currentApProgress;
      if (remainingAp >= 5) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`build_project_5ap_${project.id}`)
            .setLabel('⚡ Add 5 AP to Project')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(player.actionPoints < 5)
        );
      }

      if (player.actionPoints < 1) {
        embed.addFields([{
          name: '⚠️ Insufficient Action Points',
          value: 'You need at least 1 Action Point to contribute to this project.',
          inline: false
        }]);
      } else {
        const buildOptions = remainingAp >= 5 && player.actionPoints >= 5 
          ? 'Press the buttons below to contribute 1 AP or 5 AP to this construction project.'
          : 'Press the button below to contribute 1 AP to this construction project.';
        
        embed.addFields([{
          name: '🔨 Ready to Build',
          value: buildOptions,
          inline: false
        }]);
      }

      await interaction.reply({ 
        embeds: [embed], 
        components: [row],
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error in build command:', error);
      await interaction.reply({
        content: '❌ An error occurred while accessing construction projects.',
        ephemeral: true
      });
    }
  }
};