import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { BankService } from '../models/bank';
import { GameEngine } from '../services/gameEngine';

const playerService = new PlayerService();
const cityService = new CityService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const bankService = new BankService();
const gameEngine = GameEngine.getInstance();

const RECIPES = {
  'rotten_log_to_twisted_plank': {
    name: 'Rotten Log → Twisted Plank',
    description: 'Convert a decaying log into useful Twisted Plank',
    input: 'Rotten Log',
    output: 'Twisted Plank'
  },
  'scrap_metal_to_wrought_metal': {
    name: 'Scrap Metal → Wrought Iron', 
    description: 'Convert Scrap Metal into sturdy Wrought Iron',
    input: 'Scrap Metal',
    output: 'Wrought Iron'
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('craft')
    .setDescription('Craft items at the Workshop')
    .addStringOption(option =>
      option.setName('recipe')
        .setDescription('The recipe to craft')
        .setRequired(false)
        .addChoices(
          { name: 'Rotten Log → Twisted Plank', value: 'rotten_log_to_twisted_plank' },
          { name: 'Scrap Metal → Wrought Iron', value: 'scrap_metal_to_wrought_metal' }
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const recipeChoice = interaction.options.get('recipe')?.value as string;

      // Check if player can perform action (1 AP required for crafting)
      const actionCheck = await gameEngine.canPerformAction(discordId, 1);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Craft')
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
          .setTitle('Cannot Craft')
          .setDescription('You must be in the city to use the Workshop. Use `/return` to go back to the city first.');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get city and check if workshop exists
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ No city found. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      const allBuildings = await cityService.getCityBuildings(city.id);
      const hasWorkshop = allBuildings.some(b => b.type === 'workshop' && b.isVisitable);

      if (!hasWorkshop) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Workshop Not Available')
          .setDescription('The Workshop has not been built yet. Complete the Workshop construction project first.');
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // If no recipe specified, show available recipes
      if (!recipeChoice) {
        await this.showRecipes(interaction, player);
        return;
      }

      // Process the specific recipe
      await this.craftRecipe(interaction, player, city.id, recipeChoice);

    } catch (error) {
      console.error('Error in craft command:', error);
      await interaction.reply({
        content: '❌ An error occurred while crafting.',
        ephemeral: true
      });
    }
  },

  async showRecipes(interaction: CommandInteraction, player: any) {
    const embed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle('🔨 Workshop - Available Recipes')
      .setDescription('Select a recipe to craft items. Each recipe costs 3 Action Points.')
      .addFields([
        {
          name: '⚡ Your Action Points',
          value: `${player.actionPoints}/10`,
          inline: true
        },
        {
          name: '🔄 Available Recipes',
          value: '• Rotten Log → Twisted Plank\n• Scrap Metal → Wrought Iron',
          inline: false
        },
        {
          name: '💡 How to Craft',
          value: 'Use `/craft [recipe]` to craft a specific item, or select from the dropdown below.',
          inline: false
        }
      ]);

    // Create recipe selection dropdown
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('craft_recipe_select')
      .setPlaceholder('Choose a recipe to craft...')
      .addOptions([
        {
          label: 'Rotten Log → Twisted Plank',
          description: 'Convert Rotten Log into useful Twisted Plank',
          value: 'rotten_log_to_twisted_plank'
        },
        {
          label: 'Scrap Metal → Wrought Iron',
          description: 'Convert Scrap Metal into sturdy Wrought Iron',
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

  async craftRecipe(interaction: CommandInteraction, player: any, cityId: string, recipeKey: string) {
    const recipe = RECIPES[recipeKey as keyof typeof RECIPES];
    if (!recipe) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Invalid Recipe')
        .setDescription('The selected recipe is not valid.');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Check action points
    if (player.actionPoints < 3) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Insufficient Action Points')
        .setDescription('You need at least 3 Action Points to use the workshop.');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Try to get input item from inventory first, then bank
    const inputItem = await itemService.getItemByName(recipe.input);
    if (!inputItem) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Recipe Error')
        .setDescription(`Input item "${recipe.input}" not found in database.`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const outputItem = await itemService.getItemByName(recipe.output);
    if (!outputItem) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Recipe Error')
        .setDescription(`Output item "${recipe.output}" not found in database.`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Check inventory first
    const playerInventory = await inventoryService.getDetailedPlayerInventory(player.id);
    const inventoryItem = playerInventory.find(item => item.item.name === recipe.input);
    
    let sourceLocation = '';
    let hasInputItem = false;

    if (inventoryItem && inventoryItem.quantity > 0) {
      hasInputItem = true;
      sourceLocation = 'inventory';
    } else {
      // Check bank
      const bankInventory = await bankService.getBankInventory(cityId);
      const bankItem = bankInventory.find(item => item.item.name === recipe.input);
      
      if (bankItem && bankItem.quantity > 0) {
        hasInputItem = true;
        sourceLocation = 'bank';
      }
    }

    if (!hasInputItem) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Missing Materials')
        .setDescription(`You don't have any ${recipe.input} in your inventory or the bank.`)
        .addFields([
          {
            name: '📦 Required Materials',
            value: `1x ${recipe.input}`,
            inline: true
          },
          {
            name: '💡 Where to Find',
            value: 'Try scavenging in the wasteland to find materials.',
            inline: true
          }
        ]);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Show confirmation before crafting
    const embed = new EmbedBuilder()
      .setColor('#d4af37')
      .setTitle(`🔨 ${recipe.name}`)
      .setDescription(recipe.description)
      .addFields([
        {
          name: '📋 Recipe Requirements',
          value: `**Input:** 1x ${recipe.input}\n**Output:** 1x ${recipe.output}\n**Cost:** 3 Action Points`,
          inline: false
        },
        {
          name: '📦 Material Source',
          value: sourceLocation === 'inventory' ? '🎒 Player Inventory' : '🏦 Town Bank',
          inline: true
        },
        {
          name: '⚡ Your Action Points',
          value: `${player.actionPoints}/10`,
          inline: true
        },
        {
          name: '✅ Ready to Craft',
          value: 'Click the button below to confirm crafting.',
          inline: false
        }
      ]);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_craft_${recipeKey}_${sourceLocation}`)
          .setLabel('🔨 Craft Item (3 AP)')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
};