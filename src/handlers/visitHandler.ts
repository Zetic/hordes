import { ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';
import { CityService } from '../models/city';
import { InventoryService } from '../models/inventory';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();
const cityService = new CityService();
const inventoryService = new InventoryService();

export async function handleTakeWaterRationButton(interaction: ButtonInteraction) {
  try {
    const discordId = interaction.user.id;

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ No city found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Take water ration
    const result = await constructionService.takeWaterRation(player.id, city.id);
    
    let embed: EmbedBuilder;
    
    if (result.success) {
      embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('💧 Water Ration Taken!')
        .setDescription(result.message)
        .addFields([
          {
            name: '📅 Daily Status',
            value: `You have now taken ${result.rationsTaken} water ration(s) today`,
            inline: false
          }
        ]);

      // Send public message about taking water ration
      const publicEmbed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('💧 Water Ration')
        .setDescription(`${player.name} ${result.rationsTaken === 2 ? 'took their second water ration of the day' : 'took a water ration from the well'}.`);

      // Reply with private success message
      await interaction.update({ embeds: [embed], components: [] });
      
      // Send public message
      try {
        await interaction.followUp({ embeds: [publicEmbed] });
      } catch (error) {
        console.error('Failed to send public water ration message:', error);
      }
    } else {
      embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Take Water Ration')
        .setDescription(result.message);

      await interaction.update({ embeds: [embed], components: [] });
    }

  } catch (error) {
    console.error('Error handling take water ration button:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while taking the water ration.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}

export async function handleWorkshopRecipeSelect(interaction: StringSelectMenuInteraction) {
  try {
    const discordId = interaction.user.id;
    const selectedRecipe = interaction.values[0];

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check action points
    if (player.actionPoints < 3) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need at least 3 Action Points to use the workshop.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get player inventory
    const inventory = await inventoryService.getDetailedPlayerInventory(player.id);

    let recipeDetails = {};
    let inputItemName = '';
    let outputItemName = '';
    let hasInputItem = false;

    if (selectedRecipe === 'rotten_log_to_twisted_plank') {
      inputItemName = 'Rotten Log';
      outputItemName = 'Twisted Plank';
      recipeDetails = {
        name: 'Rotten Log → Twisted Plank',
        description: 'Convert a decaying log into a useful wooden plank',
        input: inputItemName,
        output: outputItemName
      };
    } else if (selectedRecipe === 'scrap_metal_to_wrought_metal') {
      inputItemName = 'Scrap Metal';
      outputItemName = 'Wrought Metal';
      recipeDetails = {
        name: 'Scrap Metal → Wrought Metal',
        description: 'Process scrap metal into sturdy wrought metal',
        input: inputItemName,
        output: outputItemName
      };
    } else {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Invalid Recipe')
        .setDescription('The selected recipe is not valid.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check if player has the input item
    const inputItem = inventory.find(item => item.item.name === inputItemName);
    hasInputItem = !!(inputItem && inputItem.quantity > 0);

    const embed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle(`🔨 ${(recipeDetails as any).name}`)
      .setDescription((recipeDetails as any).description)
      .addFields([
        {
          name: '📋 Recipe Requirements',
          value: `**Input:** 1x ${inputItemName}\n**Output:** 1x ${outputItemName}\n**Cost:** 3 Action Points`,
          inline: false
        },
        {
          name: '📦 Your Inventory',
          value: `${inputItemName}: ${inputItem ? inputItem.quantity : 0}`,
          inline: true
        },
        {
          name: '⚡ Your Action Points',
          value: `${player.actionPoints}/10`,
          inline: true
        }
      ]);

    if (!hasInputItem) {
      embed.addFields([{
        name: '❌ Missing Materials',
        value: `You don't have any ${inputItemName} to convert.`,
        inline: false
      }]);
      embed.setColor('#ff6b6b');
    } else {
      embed.addFields([{
        name: '✅ Ready to Craft',
        value: 'You have the required materials and action points to perform this conversion.',
        inline: false
      }]);
      
      // TODO: Add craft button here when we implement the actual crafting system
      embed.addFields([{
        name: '🚧 Coming Soon',
        value: 'The crafting system is currently under development.',
        inline: false
      }]);
    }

    await interaction.update({ embeds: [embed], components: [] });

  } catch (error) {
    console.error('Error handling workshop recipe select:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while processing the recipe selection.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}

export async function handleObserveHordeButton(interaction: ButtonInteraction) {
  try {
    const discordId = interaction.user.id;

    // Get player
    const player = await playerService.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ No city found.',
        embeds: [],
        components: []
      });
      return;
    }

    // TODO: Implement actual horde size estimation system
    // For now, show a placeholder implementation
    
    // Record this player's observation for the day
    const today = new Date().toISOString().split('T')[0];
    
    // Mock horde size estimate (this should be replaced with actual game logic)
    const mockHordeSize = Math.floor(Math.random() * 50) + 20; // Random between 20-70
    const mockAccuracy = Math.floor(Math.random() * 40) + 30; // Random accuracy 30-70%
    
    const embed = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle('🔭 Horde Observation')
      .setDescription('You peer through the observation equipment and scan the wasteland...')
      .addFields([
        {
          name: '👁️ Estimated Horde Size',
          value: `Approximately ${mockHordeSize} zombies`,
          inline: true
        },
        {
          name: '📊 Estimate Accuracy',
          value: `${mockAccuracy}% confidence`,
          inline: true
        },
        {
          name: '📝 Observer Notes',
          value: `${player.name} contributed to today's horde intelligence gathering.`,
          inline: false
        },
        {
          name: '💡 Intelligence Tip',
          value: 'More observations from different players will improve accuracy. Encourage others to visit the Watch Tower!',
          inline: false
        }
      ]);

    await interaction.update({ embeds: [embed], components: [] });

    // TODO: Store the observation in the database and improve accuracy based on number of daily observers

  } catch (error) {
    console.error('Error handling observe horde button:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while observing the horde.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}