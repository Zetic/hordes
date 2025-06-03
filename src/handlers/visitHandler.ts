import { ButtonInteraction, StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';
import { CityService } from '../models/city';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { BankService } from '../models/bank';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();
const cityService = new CityService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const bankService = new BankService();

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

    // Check if player's inventory is full first
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    if (isEncumbered) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Inventory Full')
        .setDescription('Your inventory is full. You cannot take a water ration right now.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Take water ration
    const result = await constructionService.takeWaterRation(player.id, city.id);
    
    let embed: EmbedBuilder;
    
    if (result.success) {
      // Actually give the player a water ration item
      const waterRationItem = await itemService.getItemByName('Water Ration');
      if (waterRationItem) {
        await inventoryService.addItemToInventory(player.id, waterRationItem.id, 1);
      }

      embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('💧 Water Ration Taken!')
        .setDescription(result.message)
        .addFields([
          {
            name: '📅 Daily Status',
            value: `You have now taken ${result.rationsTaken} water ration(s) today`,
            inline: false
          },
          {
            name: '🎒 Inventory',
            value: 'A water ration has been added to your inventory',
            inline: false
          }
        ]);

      // Send public message about taking water ration
      const publicEmbed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('💧 Water Ration')
        .setDescription(`${player.name} ${result.rationsTaken === 2 ? 'took their second water ration of the day' : 'took a water ration from the well'}.`);

      // Add back button
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

      // Reply with private success message
      await interaction.update({ embeds: [embed], components: [backRow] });
      
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

      // Add back button for error case too
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

      await interaction.update({ embeds: [embed], components: [backRow] });
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
      outputItemName = 'Wrought Iron';
      recipeDetails = {
        name: 'Scrap Metal → Wrought Iron',
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
      
      // Add craft button
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`craft_recipe_${selectedRecipe}`)
            .setLabel('🔨 Craft Item (3 AP)')
            .setStyle(ButtonStyle.Primary)
        );
      
      await interaction.update({ embeds: [embed], components: [row] });
      return;
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
export async function handleCraftRecipeSelect(interaction: StringSelectMenuInteraction) {
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

    // Process recipe like the craft command does
    const craftCommand = require('../commands/craft');
    await craftCommand.craftRecipe(interaction, player, city.id, selectedRecipe);

  } catch (error) {
    console.error('Error handling craft recipe select:', error);
    
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

export async function handleConfirmCraftButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    // Format: confirm_craft_{recipe}_{source}
    const parts = customId.split('_');
    if (parts.length < 4) {
      throw new Error('Invalid custom ID format');
    }
    
    const recipe = parts[2];
    const sourceLocation = parts[3];
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

    // Define recipe mappings
    const RECIPES = {
      'rotten_log_to_twisted_plank': {
        input: 'Rotten Log',
        output: 'Twisted Plank'
      },
      'scrap_metal_to_wrought_metal': {
        input: 'Scrap Metal',
        output: 'Wrought Iron'
      }
    };

    const recipeInfo = RECIPES[recipe as keyof typeof RECIPES];
    if (!recipeInfo) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Invalid Recipe')
        .setDescription('The selected recipe is not valid.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check action points
    if (player.actionPoints < 3) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need at least 3 Action Points to craft.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Get input and output items
    const inputItem = await itemService.getItemByName(recipeInfo.input);
    const outputItem = await itemService.getItemByName(recipeInfo.output);
    
    if (!inputItem || !outputItem) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Recipe Error')
        .setDescription('One or more recipe items not found in database.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Remove input item from source (inventory or bank)
    let removeSuccess = false;
    if (sourceLocation === 'inventory') {
      removeSuccess = await inventoryService.removeItemFromInventory(player.id, inputItem.id, 1);
    } else if (sourceLocation === 'bank') {
      removeSuccess = await bankService.withdrawItem(city.id, inputItem.id, 1);
    }

    if (!removeSuccess) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Remove Materials')
        .setDescription(`Failed to remove ${recipeInfo.input} from ${sourceLocation}.`);

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Spend action points
    const apSuccess = await playerService.spendActionPoints(discordId, 3);
    if (!apSuccess) {
      // Refund the input item if AP spending failed
      if (sourceLocation === 'inventory') {
        await inventoryService.addItemToInventory(player.id, inputItem.id, 1);
      } else if (sourceLocation === 'bank') {
        await bankService.depositItem(city.id, inputItem.id, 1);
      }

      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Spend Action Points')
        .setDescription('Failed to spend action points. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Try to add output item to inventory first, then bank if inventory is full
    let outputLocation = 'inventory';
    let addSuccess = await inventoryService.addItemToInventory(player.id, outputItem.id, 1);
    
    if (!addSuccess) {
      // Try to add to bank instead
      addSuccess = await bankService.depositItem(city.id, outputItem.id, 1);
      outputLocation = 'bank';
    }

    if (!addSuccess) {
      // Refund everything if both failed
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints + 3);
      if (sourceLocation === 'inventory') {
        await inventoryService.addItemToInventory(player.id, inputItem.id, 1);
      } else if (sourceLocation === 'bank') {
        await bankService.depositItem(city.id, inputItem.id, 1);
      }
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Store Output')
        .setDescription('Failed to add the crafted item to inventory or bank. Both are full!');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Success!
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔨 Item Crafted Successfully!')
      .setDescription(`You have successfully converted **${recipeInfo.input}** into **${recipeInfo.output}** at the Workshop.`)
      .addFields([
        {
          name: '📦 Conversion',
          value: `${recipeInfo.input} → ${recipeInfo.output}`,
          inline: true
        },
        {
          name: '📍 Materials From',
          value: sourceLocation === 'inventory' ? '🎒 Your Inventory' : '🏦 Town Bank',
          inline: true
        },
        {
          name: '📍 Output To',
          value: outputLocation === 'inventory' ? '🎒 Your Inventory' : '🏦 Town Bank',
          inline: true
        },
        {
          name: '⚡ Action Points Used',
          value: '3 AP',
          inline: true
        }
      ]);

    await interaction.update({ embeds: [embed], components: [] });

    // Send public crafting message
    const publicEmbed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle('🔨 Workshop Activity')
      .setDescription(`${player.name} crafted **${recipeInfo.output}** at the Workshop.`);

    try {
      await interaction.followUp({ embeds: [publicEmbed] });
    } catch (error) {
      console.error('Failed to send public crafting message:', error);
    }

  } catch (error) {
    console.error('Error handling confirm craft button:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while crafting the item.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}

export async function handleCraftRecipeButton(interaction: ButtonInteraction) {
  try {
    const customId = interaction.customId;
    const [, , selectedRecipe] = customId.split('_'); // craft_recipe_{recipe}
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

    let inputItemName = '';
    let outputItemName = '';

    if (selectedRecipe === 'rotten_log_to_twisted_plank') {
      inputItemName = 'Rotten Log';
      outputItemName = 'Twisted Plank';
    } else if (selectedRecipe === 'scrap_metal_to_wrought_metal') {
      inputItemName = 'Scrap Metal';
      outputItemName = 'Wrought Iron';
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
    if (!inputItem || inputItem.quantity < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Missing Materials')
        .setDescription(`You don't have any ${inputItemName} to convert.`);

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Spend action points
    const apSuccess = await playerService.spendActionPoints(discordId, 3);
    if (!apSuccess) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Spend Action Points')
        .setDescription('Failed to spend action points. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Remove input item from inventory
    const removeSuccess = await inventoryService.removeItemFromInventory(player.id, inputItem.itemId, 1);
    if (!removeSuccess) {
      // Refund action points if item removal failed
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints + 3);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Remove Materials')
        .setDescription('Failed to remove input materials. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Add output item to inventory
    const outputItem = await itemService.getItemByName(outputItemName);
    if (!outputItem) {
      // Refund everything if output item doesn't exist
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints + 3);
      await inventoryService.addItemToInventory(player.id, inputItem.itemId, 1);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Output Item Not Found')
        .setDescription(`The output item "${outputItemName}" was not found in the item database.`);

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    const addSuccess = await inventoryService.addItemToInventory(player.id, outputItem.id, 1);
    if (!addSuccess) {
      // Refund everything if add failed
      await playerService.updatePlayerActionPoints(discordId, player.actionPoints + 3);
      await inventoryService.addItemToInventory(player.id, inputItem.itemId, 1);
      
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Failed to Add Output Item')
        .setDescription('Failed to add the crafted item to your inventory. Please try again.');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Success!
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🔨 Item Crafted Successfully!')
      .setDescription(`You have successfully converted **${inputItemName}** into **${outputItemName}** at the Workshop.`)
      .addFields([
        {
          name: '📦 Conversion',
          value: `${inputItemName} → ${outputItemName}`,
          inline: true
        },
        {
          name: '⚡ Action Points Used',
          value: '3 AP',
          inline: true
        },
        {
          name: '🏭 Location',
          value: 'Workshop',
          inline: true
        }
      ]);

    await interaction.update({ embeds: [embed], components: [] });

    // Send public crafting message
    const publicEmbed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle('🔨 Workshop Activity')
      .setDescription(`${player.name} crafted **${outputItemName}** at the Workshop.`);

    try {
      await interaction.followUp({ embeds: [publicEmbed] });
    } catch (error) {
      console.error('Failed to send public crafting message:', error);
    }

  } catch (error) {
    console.error('Error handling craft recipe button:', error);
    
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('❌ Error')
      .setDescription('An error occurred while crafting the item.');

    try {
      await interaction.update({ embeds: [embed], components: [] });
    } catch (updateError) {
      console.error('Failed to update interaction with error message:', updateError);
    }
  }
}
