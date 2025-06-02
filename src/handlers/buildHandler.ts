import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';
import { CityService } from '../models/city';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();
const cityService = new CityService();

export async function handleBuildProjectButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  
  // Check if this is a 5 AP button
  if (customId.includes('build_project_5ap_')) {
    await handleBuildProject5ApButton(interaction);
    return;
  }
  
  // Handle regular 1 AP button
  await handleBuildProject1ApButton(interaction);
}

async function handleBuildProject1ApButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    const [, , projectId] = customId.split('_'); // build_project_{projectId}
    
    const discordId = interaction.user.id;

    // Check if player can perform action (1 AP required for building)
    const actionCheck = await gameEngine.canPerformAction(discordId, 1);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Build')
        .setDescription(actionCheck.reason || 'Unknown error');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found. Use `/join` to start playing.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is in the city
    if (player.location !== 'city') {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Build')
        .setDescription('You must be in the city to work on construction projects.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check action points
    if (player.actionPoints < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need at least 1 Action Point to contribute to construction projects.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get project details
    const project = await constructionService.getProject(projectId);
    if (!project) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Project Not Found')
        .setDescription('This construction project no longer exists or has been completed.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    if (project.isCompleted) {
      const embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('✅ Project Already Completed')
        .setDescription(`The ${project.projectName} has already been completed!`);

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Spend action point
    const success = await playerService.spendActionPoints(discordId, 1);
    if (!success) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Spend Action Points')
        .setDescription('Failed to spend action points. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Add AP to project
    const addApSuccess = await constructionService.addApToProject(projectId, 1);
    if (!addApSuccess) {
      // Refund the action point if project update failed
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Contribute to Project')
        .setDescription('Failed to add progress to the construction project. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get updated project to check if completed
    const updatedProject = await constructionService.getProject(projectId);
    if (!updatedProject) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Error')
        .setDescription('Unable to retrieve updated project information.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    let embed: EmbedBuilder;
    
    if (updatedProject.isCompleted) {
      // Project completed!
      embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Construction Project Completed!')
        .setDescription(`**${updatedProject.projectName}** has been completed and is now part of the town!`)
        .addFields([
          {
            name: '🏗️ Project Details',
            value: updatedProject.description,
            inline: false
          },
          {
            name: '👷 Final Contribution',
            value: `${player.name} contributed the final Action Point needed to complete this project!`,
            inline: false
          }
        ]);

      if (updatedProject.defenseBonus > 0) {
        embed.addFields([{
          name: '🛡️ Defense Bonus Added',
          value: `The town's defense has increased by ${updatedProject.defenseBonus}!`,
          inline: false
        }]);
      }

      if (updatedProject.isVisitable) {
        embed.addFields([{
          name: '🚪 New Building Available',
          value: `The ${updatedProject.projectName} is now available for use!`,
          inline: false
        }]);
      }

      // Send public announcement
      const announcementEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🏗️ ${updatedProject.projectName} Completed!`)
        .setDescription(`The town's ${updatedProject.projectName} construction project has been completed thanks to everyone's contributions!`)
        .addFields([{
          name: '📊 Final Statistics',
          value: `**Total AP Required:** ${updatedProject.totalApRequired}\n**Category:** ${updatedProject.category} > ${updatedProject.subCategory}`,
          inline: false
        }]);

      if (updatedProject.defenseBonus > 0) {
        announcementEmbed.addFields([{
          name: '🛡️ Town Defense Increased',
          value: `+${updatedProject.defenseBonus} Defense`,
          inline: true
        }]);
      }

      // Reply with both private success message and public announcement
      await interaction.update({ embeds: [embed], components: [] });
      
      // Send public announcement to the same channel
      try {
        await interaction.followUp({ embeds: [announcementEmbed] });
      } catch (error) {
        console.error('Failed to send public completion announcement:', error);
      }
    } else {
      // Project still in progress
      const progressPercent = Math.round((updatedProject.currentApProgress / updatedProject.totalApRequired) * 100);
      
      // Get city and check material requirements for live updates
      const city = await cityService.getDefaultCity();
      let materialRequirementsText = 'No materials required';
      if (city) {
        const materialCheck = await constructionService.checkMaterialRequirements(projectId, city.id);
        materialRequirementsText = materialCheck.details.map(detail => 
          `${detail.itemName}: ${detail.available}/${detail.required} ${detail.available >= detail.required ? '✅' : '❌'}`
        ).join('\n') || 'No materials required';
      }
      
      embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('🔨 Contribution Added!')
        .setDescription(`You contributed 1 AP to the **${updatedProject.projectName}** construction project.`)
        .addFields([
          {
            name: '📊 Updated Progress',
            value: `${updatedProject.currentApProgress}/${updatedProject.totalApRequired} AP (${progressPercent}%)`,
            inline: true
          },
          {
            name: '⚡ Action Points Used',
            value: '1 AP',
            inline: true
          },
          {
            name: '🔧 Materials Status',
            value: materialRequirementsText,
            inline: false
          },
          {
            name: '🏭 Project Category',
            value: `${updatedProject.category} > ${updatedProject.subCategory}`,
            inline: false
          }
        ]);

      const remainingAp = updatedProject.totalApRequired - updatedProject.currentApProgress;
      embed.addFields([{
        name: '🎯 Next Steps',
        value: `${remainingAp} more AP needed to complete this project. Keep contributing!`,
        inline: false
      }]);

      // Get updated player info to check remaining AP
      const updatedPlayer = await playerService.getPlayer(discordId);
      const currentAP = updatedPlayer ? updatedPlayer.actionPoints : 0;

      // Create continuous build buttons
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      // Always add the 1 AP button
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`build_project_${projectId}`)
          .setLabel('🔨 Add 1 AP')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentAP < 1)
      );

      // Add 5 AP button if player has enough AP and project needs at least 5 AP
      if (remainingAp >= 5) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`build_project_5ap_${projectId}`)
            .setLabel('⚡ Add 5 AP')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentAP < 5)
        );
      }

      // Add current AP status to embed
      embed.addFields([{
        name: '⚡ Your Action Points',
        value: `${currentAP} AP remaining`,
        inline: true
      }]);

      await interaction.update({ embeds: [embed], components: [row] });

      // Send milestone announcements
      const prevProgress = updatedProject.currentApProgress - 1;
      const isFirstContribution = prevProgress === 0;
      const prevPercent = Math.round((prevProgress / updatedProject.totalApRequired) * 100);
      const currentPercent = Math.round((updatedProject.currentApProgress / updatedProject.totalApRequired) * 100);
      const hit50Percent = prevPercent < 50 && currentPercent >= 50;

      if (isFirstContribution) {
        const firstContribEmbed = new EmbedBuilder()
          .setColor('#4ecdc4')
          .setTitle('🏁 Construction Started!')
          .setDescription(`${player.name} laid the first foundation for the **${updatedProject.projectName}** project!`);
        
        try {
          await interaction.followUp({ embeds: [firstContribEmbed] });
        } catch (error) {
          console.error('Failed to send first contribution announcement:', error);
        }
      } else if (hit50Percent) {
        const halfwayEmbed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('🎯 Halfway There!')
          .setDescription(`The **${updatedProject.projectName}** project has reached ${currentPercent}% completion! Keep building!`);
        
        try {
          await interaction.followUp({ embeds: [halfwayEmbed] });
        } catch (error) {
          console.error('Failed to send 50% completion announcement:', error);
        }
      }
    }

  } catch (error) {
    console.error('Error in build project handler:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while contributing to the construction project.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}

async function handleBuildProject5ApButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    const [, , , projectId] = customId.split('_'); // build_project_5ap_{projectId}
    
    const discordId = interaction.user.id;

    // Check if player can perform action (5 AP required for 5 AP building)
    const actionCheck = await gameEngine.canPerformAction(discordId, 5);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Build')
        .setDescription(actionCheck.reason || 'Unknown error');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found. Use `/join` to start playing.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is in the city
    if (player.location !== 'city') {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Build')
        .setDescription('You must be in the city to work on construction projects.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check action points
    if (player.actionPoints < 5) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need at least 5 Action Points to contribute 5 AP to construction projects.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get project details
    const project = await constructionService.getProject(projectId);
    if (!project) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Project Not Found')
        .setDescription('This construction project no longer exists or has been completed.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    if (project.isCompleted) {
      const embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('✅ Project Already Completed')
        .setDescription(`The ${project.projectName} has already been completed!`);

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check if project needs at least 5 AP
    const remainingNeeded = project.totalApRequired - project.currentApProgress;
    const apToAdd = Math.min(5, remainingNeeded);

    // Spend action points
    const success = await playerService.spendActionPoints(discordId, apToAdd);
    if (!success) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Spend Action Points')
        .setDescription('Failed to spend action points. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Add AP to project
    const addApSuccess = await constructionService.addApToProject(projectId, apToAdd);
    if (!addApSuccess) {
      // Refund the action points if project update failed
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Contribute to Project')
        .setDescription('Failed to add progress to the construction project. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get updated project to check if completed
    const updatedProject = await constructionService.getProject(projectId);
    if (!updatedProject) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Error')
        .setDescription('Unable to retrieve updated project information.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    let embed: EmbedBuilder;
    
    if (updatedProject.isCompleted) {
      // Project completed!
      embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Construction Project Completed!')
        .setDescription(`**${updatedProject.projectName}** has been completed and is now part of the town!`)
        .addFields([
          {
            name: '🏗️ Project Details',
            value: updatedProject.description,
            inline: false
          },
          {
            name: '👷 Final Contribution',
            value: `${player.name} contributed ${apToAdd} Action Point${apToAdd > 1 ? 's' : ''} to complete this project!`,
            inline: false
          }
        ]);

      if (updatedProject.defenseBonus > 0) {
        embed.addFields([{
          name: '🛡️ Defense Bonus Added',
          value: `The town's defense has increased by ${updatedProject.defenseBonus}!`,
          inline: false
        }]);
      }

      if (updatedProject.isVisitable) {
        embed.addFields([{
          name: '🚪 New Building Available',
          value: `The ${updatedProject.projectName} is now available for use!`,
          inline: false
        }]);
      }

      // Send public announcement
      const announcementEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🏗️ ${updatedProject.projectName} Completed!`)
        .setDescription(`The town's ${updatedProject.projectName} construction project has been completed thanks to everyone's contributions!`)
        .addFields([{
          name: '📊 Final Statistics',
          value: `**Total AP Required:** ${updatedProject.totalApRequired}\n**Category:** ${updatedProject.category} > ${updatedProject.subCategory}`,
          inline: false
        }]);

      if (updatedProject.defenseBonus > 0) {
        announcementEmbed.addFields([{
          name: '🛡️ Town Defense Increased',
          value: `+${updatedProject.defenseBonus} Defense`,
          inline: true
        }]);
      }

      // Reply with both private success message and public announcement
      await interaction.update({ embeds: [embed], components: [] });
      
      // Send public announcement to the same channel
      try {
        await interaction.followUp({ embeds: [announcementEmbed] });
      } catch (error) {
        console.error('Failed to send public completion announcement:', error);
      }
    } else {
      // Project still in progress
      const progressPercent = Math.round((updatedProject.currentApProgress / updatedProject.totalApRequired) * 100);
      
      // Get city and check material requirements for live updates
      const city = await cityService.getDefaultCity();
      let materialRequirementsText = 'No materials required';
      if (city) {
        const materialCheck = await constructionService.checkMaterialRequirements(projectId, city.id);
        materialRequirementsText = materialCheck.details.map(detail => 
          `${detail.itemName}: ${detail.available}/${detail.required} ${detail.available >= detail.required ? '✅' : '❌'}`
        ).join('\n') || 'No materials required';
      }
      
      embed = new EmbedBuilder()
        .setColor('#45b7d1')
        .setTitle('⚡ Major Contribution Added!')
        .setDescription(`You contributed ${apToAdd} AP to the **${updatedProject.projectName}** construction project.`)
        .addFields([
          {
            name: '📊 Updated Progress',
            value: `${updatedProject.currentApProgress}/${updatedProject.totalApRequired} AP (${progressPercent}%)`,
            inline: true
          },
          {
            name: '⚡ Action Points Used',
            value: `${apToAdd} AP`,
            inline: true
          },
          {
            name: '🔧 Materials Status',
            value: materialRequirementsText,
            inline: false
          },
          {
            name: '🏭 Project Category',
            value: `${updatedProject.category} > ${updatedProject.subCategory}`,
            inline: false
          }
        ]);

      const remainingAp = updatedProject.totalApRequired - updatedProject.currentApProgress;
      embed.addFields([{
        name: '🎯 Next Steps',
        value: `${remainingAp} more AP needed to complete this project. Keep contributing!`,
        inline: false
      }]);

      // Get updated player info to check remaining AP
      const updatedPlayer = await playerService.getPlayer(discordId);
      const currentAP = updatedPlayer ? updatedPlayer.actionPoints : 0;

      // Create continuous build buttons
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      // Always add the 1 AP button
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`build_project_${projectId}`)
          .setLabel('🔨 Add 1 AP')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentAP < 1)
      );

      // Add 5 AP button if player has enough AP and project needs at least 5 AP
      if (remainingAp >= 5) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`build_project_5ap_${projectId}`)
            .setLabel('⚡ Add 5 AP')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentAP < 5)
        );
      }

      // Add current AP status to embed
      embed.addFields([{
        name: '⚡ Your Action Points',
        value: `${currentAP} AP remaining`,
        inline: true
      }]);

      await interaction.update({ embeds: [embed], components: [row] });

      // Send milestone announcements
      const prevProgress = updatedProject.currentApProgress - apToAdd;
      const isFirstContribution = prevProgress === 0;
      const prevPercent = Math.round((prevProgress / updatedProject.totalApRequired) * 100);
      const currentPercent = Math.round((updatedProject.currentApProgress / updatedProject.totalApRequired) * 100);
      const hit50Percent = prevPercent < 50 && currentPercent >= 50;

      if (isFirstContribution) {
        const firstContribEmbed = new EmbedBuilder()
          .setColor('#4ecdc4')
          .setTitle('🏁 Construction Started!')
          .setDescription(`${player.name} laid the first foundation for the **${updatedProject.projectName}** project!`);
        
        try {
          await interaction.followUp({ embeds: [firstContribEmbed] });
        } catch (error) {
          console.error('Failed to send first contribution announcement:', error);
        }
      } else if (hit50Percent) {
        const halfwayEmbed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('🎯 Halfway There!')
          .setDescription(`The **${updatedProject.projectName}** project has reached ${currentPercent}% completion! Keep building!`);
        
        try {
          await interaction.followUp({ embeds: [halfwayEmbed] });
        } catch (error) {
          console.error('Failed to send 50% completion announcement:', error);
        }
      }
    }

  } catch (error) {
    console.error('Error in build project 5 AP handler:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while contributing to the construction project.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}