import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { CityService } from '../models/city';
import { BankService } from '../models/bank';
import { ItemService } from '../models/item';
import { GameEngine } from '../services/gameEngine';
import { Location } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const cityService = new CityService();
const bankService = new BankService();
const itemService = new ItemService();
const gameEngine = GameEngine.getInstance();

export async function handleNavigationButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  const discordId = interaction.user.id;

  // Get player to check location for back button context
  const player = await playerService.getPlayer(discordId);
  if (!player) {
    await interaction.update({
      content: '❌ Player not found. Use `/join` to start playing.',
      embeds: [],
      components: []
    });
    return;
  }

  switch (customId) {
    case 'nav_bag':
      await handleBagNavigation(interaction, player);
      break;
    case 'nav_status':
      await handleStatusNavigation(interaction, player);
      break;
    case 'nav_bank':
      await handleBankNavigation(interaction, player);
      break;
    case 'nav_build':
      await handleBuildNavigation(interaction, player);
      break;
    case 'nav_craft':
      await handleCraftNavigation(interaction, player);
      break;
    case 'nav_gate':
      await handleGateNavigation(interaction, player);
      break;
    case 'nav_well':
      await handleWellNavigation(interaction, player);
      break;
    case 'nav_tower':
      await handleTowerNavigation(interaction, player);
      break;
    case 'nav_back_play':
      // Back to play menu from any navigation screen
      await handleBackToPlay(interaction);
      break;
    case 'nav_back_map':
      // Back to map - this would need to call the map command
      await handleBackToMap(interaction);
      break;
    case 'gate_open':
      await handleGateOpen(interaction, player);
      break;
    case 'gate_close':
      await handleGateClose(interaction, player);
      break;
    case 'gate_depart':
      await handleGateDepart(interaction, player);
      break;
    default:
      await interaction.update({
        content: '❌ Unknown navigation option.',
        embeds: [],
        components: []
      });
  }
}

async function handleBagNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Get detailed inventory (same logic as inventory command)
    const inventory = await inventoryService.getDetailedPlayerInventory(player.id);
    const inventoryCount = await inventoryService.getInventoryCount(player.id);
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    const maxItems = InventoryService.getMaxInventorySize();

    const embed = new EmbedBuilder()
      .setColor(isEncumbered ? '#ff6b6b' : '#95e1d3')
      .setTitle(`🎒 ${player.name}'s Inventory`)
      .setDescription(isEncumbered ? '⚠️ **You are encumbered!** Drop items to move efficiently.' : 'Your current items and equipment');

    if (inventory.length === 0) {
      embed.addFields([
        {
          name: '📦 Items',
          value: 'Your inventory is empty',
          inline: false
        }
      ]);
    } else {
      // Group items and create display
      const groupedItems = new Map();
      
      inventory.forEach(inv => {
        const key = inv.item.name;
        if (groupedItems.has(key)) {
          groupedItems.set(key, groupedItems.get(key) + inv.quantity);
        } else {
          groupedItems.set(key, inv.quantity);
        }
      });

      const itemList = Array.from(groupedItems.entries())
        .map(([name, quantity]) => `**${name}** x${quantity}`)
        .join('\n');

      if (itemList.length <= 1024) {
        embed.addFields([
          {
            name: '📦 Items',
            value: itemList,
            inline: false
          }
        ]);
      } else {
        // If too long, truncate
        const truncated = itemList.substring(0, 1000) + '...';
        embed.addFields([
          {
            name: '📦 Items',
            value: truncated,
            inline: false
          }
        ]);
      }
    }

    embed.addFields([
      {
        name: '📊 Capacity',
        value: `${inventoryCount}/${maxItems} items`,
        inline: true
      },
      {
        name: '⚖️ Status',
        value: isEncumbered ? '🔴 Encumbered' : '🟢 Normal',
        inline: true
      }
    ]);

    embed.setTimestamp();

    // Create use buttons for items (max 25 buttons)
    const components: any[] = [];
    const maxButtons = 25;
    const usableItems = inventory.slice(0, maxButtons);
    
    for (let i = 0; i < usableItems.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      const itemsInRow = usableItems.slice(i, i + 5);
      
      for (const inv of itemsInRow) {
        const button = new ButtonBuilder()
          .setCustomId(`use_item_${inv.item.name}`)
          .setLabel(`Use ${inv.item.name}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎯');
        
        row.addComponents(button);
      }
      
      components.push(row);
    }

    // Add back button based on location
    const backButton = new ButtonBuilder()
      .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
      .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    components.push(backRow);

    await interaction.update({ 
      embeds: [embed], 
      components: inventory.length > 0 ? components : [backRow]
    });

  } catch (error) {
    console.error('Error in bag navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing your inventory.',
      embeds: [],
      components: []
    });
  }
}

async function handleStatusNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Import the status command logic
    const statusCommand = require('../commands/status');
    
    // Create a mock interaction for the status command
    const mockInteraction = {
      ...interaction,
      user: interaction.user,
      options: {
        get: () => null // No target player specified
      },
      reply: async (options: any) => {
        // Add back button to the status embed
        const backButton = new ButtonBuilder()
          .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
          .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
          .setStyle(ButtonStyle.Secondary);
        
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
        
        // Add back button to existing components or create new ones
        const existingComponents = options.components || [];
        const newComponents = [...existingComponents, backRow];
        
        await interaction.update({
          ...options,
          components: newComponents
        });
      }
    };

    await statusCommand.execute(mockInteraction);

  } catch (error) {
    console.error('Error in status navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing your status.',
      embeds: [],
      components: []
    });
  }
}

async function handleBankNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Check if player is in town
    if (player.location !== Location.CITY) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Access Bank')
        .setDescription('You must be in town to access the bank.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Back to Map')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Show bank interface with dropdown interactions
    const embed = new EmbedBuilder()
      .setColor('#ffd93d')
      .setTitle('🏦 Town Bank')
      .setDescription('Community storage for items. Use the dropdowns below to deposit or withdraw items.')
      .addFields([
        {
          name: '💡 Instructions',
          value: '• **Deposit**: Select an item from your inventory to store in the bank\n• **Withdraw**: Select an item from the bank to take (1 item only)\n• Items are shared with all town members',
          inline: false
        }
      ])
      .setTimestamp();

    // Create dropdown for deposit (inventory items)
    const inventoryItems = await inventoryService.getDetailedPlayerInventory(player.id);
    const depositOptions = inventoryItems.slice(0, 25).map(inv => ({
      label: `${inv.item.name} (x${inv.quantity})`,
      description: `Deposit ${inv.item.name} into the bank`,
      value: `deposit_${inv.item.name}`
    }));

    // Create dropdown for withdraw (bank items)
    const bankItems = await bankService.getBankInventory(city.id);
    const withdrawOptions = bankItems.slice(0, 25).map(inv => ({
      label: `${inv.item.name} (x${inv.quantity})`,
      description: `Withdraw 1 ${inv.item.name} from the bank`,
      value: `withdraw_${inv.item.name}`
    }));

    const components: any[] = [];

    // Add deposit dropdown if player has items
    if (depositOptions.length > 0) {
      const depositSelect = new StringSelectMenuBuilder()
        .setCustomId('bank_deposit_select')
        .setPlaceholder('Select an item to deposit')
        .addOptions(depositOptions);
      
      const depositRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(depositSelect);
      components.push(depositRow);
    }

    // Add withdraw dropdown if bank has items
    if (withdrawOptions.length > 0) {
      const withdrawSelect = new StringSelectMenuBuilder()
        .setCustomId('bank_withdraw_select')
        .setPlaceholder('Select an item to withdraw (1 item)')
        .addOptions(withdrawOptions);
      
      const withdrawRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(withdrawSelect);
      components.push(withdrawRow);
    }

    // Add back button
    const backButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    components.push(backRow);

    await interaction.update({ embeds: [embed], components });

  } catch (error) {
    console.error('Error in bank navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing the bank.',
      embeds: [],
      components: []
    });
  }
}

async function handleBuildNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Check if player is in town
    if (player.location !== Location.CITY) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Access Construction')
        .setDescription('You must be in town to access construction projects.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Back to Map')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Show build interface with project dropdown
    const embed = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle('🔨 Construction Projects')
      .setDescription('Work on construction projects to build new structures for the town. Select a project below to contribute action points.')
      .addFields([
        {
          name: '💡 Instructions',
          value: '• **Select a project** from the dropdown below\n• **Contribute AP** to help complete the project\n• Projects require both AP and materials to complete\n• All town members can contribute to any project',
          inline: false
        }
      ])
      .setTimestamp();

    // Get available construction projects
    const constructionService = require('../services/construction').ConstructionService;
    const projects = await constructionService.prototype.getAvailableProjects.call(new constructionService(), city.id);

    const components: any[] = [];

    if (projects.length > 0) {
      // Create dropdown for project selection
      const projectOptions = projects.slice(0, 25).map((project: any) => ({
        label: `${project.projectName}`,
        description: `${project.currentApProgress}/${project.totalApRequired} AP`,
        value: `build_project_${project.id}`
      }));

      const projectSelect = new StringSelectMenuBuilder()
        .setCustomId('build_project_select')
        .setPlaceholder('Select a construction project')
        .addOptions(projectOptions);
      
      const projectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(projectSelect);
      components.push(projectRow);
    } else {
      embed.addFields([
        {
          name: '📋 Available Projects',
          value: 'No construction projects are currently available.',
          inline: false
        }
      ]);
    }

    // Add back button
    const backButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    components.push(backRow);

    await interaction.update({ embeds: [embed], components });

  } catch (error) {
    console.error('Error in build navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing construction projects.',
      embeds: [],
      components: []
    });
  }
}

async function handleCraftNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Check if player is in town
    if (player.location !== Location.CITY) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Access Workshop')
        .setDescription('You must be in town to access the workshop for crafting.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Back to Map')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if workshop exists
    const allBuildings = await cityService.getCityBuildings(city.id);
    const hasWorkshop = allBuildings.some(b => b.type === 'workshop' && b.isVisitable);

    if (!hasWorkshop) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Workshop Not Available')
        .setDescription('The Workshop has not been built yet. You need a workshop to craft advanced items.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Show craft interface
    const embed = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle('⚒️ Workshop Crafting')
      .setDescription('Craft advanced items using raw materials. Select a recipe below to start crafting.')
      .addFields([
        {
          name: '🔧 Available Recipes',
          value: '• **Rotten Log → Twisted Plank**: Convert decaying wood into useful planks\n• **Scrap Metal → Wrought Iron**: Refine metal scraps into sturdy iron',
          inline: false
        },
        {
          name: '💡 Instructions',
          value: '• Select a recipe from the dropdown below\n• Make sure you have the required materials\n• Crafting costs 1 Action Point per item',
          inline: false
        }
      ])
      .setTimestamp();

    // Create dropdown for recipe selection
    const recipeOptions = [
      {
        label: 'Rotten Log → Twisted Plank',
        description: 'Convert a decaying log into useful Twisted Plank',
        value: 'craft_rotten_log_to_twisted_plank'
      },
      {
        label: 'Scrap Metal → Wrought Iron',
        description: 'Convert Scrap Metal into sturdy Wrought Iron',
        value: 'craft_scrap_metal_to_wrought_metal'
      }
    ];

    const recipeSelect = new StringSelectMenuBuilder()
      .setCustomId('craft_recipe_select')
      .setPlaceholder('Select a crafting recipe')
      .addOptions(recipeOptions);
    
    const recipeRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(recipeSelect);

    // Add back button
    const backButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

    await interaction.update({ 
      embeds: [embed], 
      components: [recipeRow, backRow]
    });

  } catch (error) {
    console.error('Error in craft navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing the workshop.',
      embeds: [],
      components: []
    });
  }
}

async function handleGateNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Show gate status (similar to gate command)
    const gateStatus = city.gateOpen ? 'Open' : 'Closed';
    const gateEmoji = city.gateOpen ? '🔓' : '🔒';
    const gateColor = city.gateOpen ? '#4ecdc4' : '#ff6b6b';

    const embed = new EmbedBuilder()
      .setColor(gateColor)
      .setTitle(`🚪 City Gate`)
      .setDescription(`The city gate is currently **${gateStatus}**.`)
      .addFields([
        { 
          name: '🚪 Gate Status', 
          value: `${gateEmoji} ${gateStatus}`, 
          inline: true 
        },
        { 
          name: '📍 Your Location', 
          value: player.location === Location.CITY ? '🏠 In City' : 
                 player.location === Location.HOME ? '🏡 At Home' :
                 player.location === Location.GATE ? '🚪 At Gate' :
                 `🌍 Outside (${player.x}, ${player.y})`, 
          inline: true 
        }
      ]);

    const components: any[] = [];

    // Only show gate control buttons if player is in city
    if (player.location === Location.CITY) {
      const gateRow = new ActionRowBuilder<ButtonBuilder>();
      
      if (city.gateOpen) {
        gateRow.addComponents(
          new ButtonBuilder()
            .setCustomId('gate_close')
            .setLabel('🔒 Close Gate')
            .setStyle(ButtonStyle.Danger)
        );
      } else {
        gateRow.addComponents(
          new ButtonBuilder()
            .setCustomId('gate_open')
            .setLabel('🔓 Open Gate')
            .setStyle(ButtonStyle.Success)
        );
      }

      // Add depart button if gate is open
      if (city.gateOpen) {
        gateRow.addComponents(
          new ButtonBuilder()
            .setCustomId('gate_depart')
            .setLabel('🚶 Depart')
            .setStyle(ButtonStyle.Primary)
        );
      }

      components.push(gateRow);
    }

    // Add appropriate back button
    const backButton = new ButtonBuilder()
      .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
      .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    components.push(backRow);

    if (city.gateOpen) {
      embed.addFields([
        {
          name: '✅ Available Actions',
          value: player.location === Location.CITY ? 
            '• Use the "Depart" button to leave town through the gate\n• Players outside can use `/return` at the gate' :
            '• Players outside can use `/return` at the gate',
          inline: false
        }
      ]);
    } else {
      embed.addFields([
        {
          name: '❌ Gate is Closed',
          value: player.location === Location.CITY ?
            '• Players cannot leave or enter the city\n• Use the "Open Gate" button to open the gate' :
            '• Players cannot leave or enter the city\n• Someone in the city must open the gate',
          inline: false
        }
      ]);
    }

    embed.setTimestamp();
    await interaction.update({ embeds: [embed], components });

  } catch (error) {
    console.error('Error in gate navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing the gate.',
      embeds: [],
      components: []
    });
  }
}

async function handleWellNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Check if player is in town
    if (player.location !== Location.CITY) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Access Well')
        .setDescription('You must be in town to visit the well.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Back to Map')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Use existing well visit logic
    const wellCommand = require('../commands/well');
    
    // Create a mock interaction for the well command
    const mockInteraction = {
      ...interaction,
      reply: async (options: any) => {
        // Add back button to the well interface
        const backButton = new ButtonBuilder()
          .setCustomId('nav_back_play')
          .setLabel('🏠 Back to Town')
          .setStyle(ButtonStyle.Secondary);
        
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
        
        // Add back button to existing components or create new ones
        const existingComponents = options.components || [];
        const newComponents = [...existingComponents, backRow];
        
        await interaction.update({
          ...options,
          components: newComponents
        });
      }
    };

    await wellCommand.visitWell(mockInteraction, player, city.id);

  } catch (error) {
    console.error('Error in well navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing the well.',
      embeds: [],
      components: []
    });
  }
}

async function handleTowerNavigation(interaction: ButtonInteraction, player: any) {
  try {
    // Check if player is in town
    if (player.location !== Location.CITY) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Cannot Access Watch Tower')
        .setDescription('You must be in town to visit the watch tower.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Back to Map')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if watch tower exists
    const allBuildings = await cityService.getCityBuildings(city.id);
    const hasWatchTower = allBuildings.some(b => b.type === 'watch_tower' && b.isVisitable);

    if (!hasWatchTower) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Watch Tower Not Available')
        .setDescription('The Watch Tower has not been built yet. Complete the Watch Tower construction project first.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Use existing tower visit logic
    const towerCommand = require('../commands/tower');
    
    // Create a mock interaction for the tower command
    const mockInteraction = {
      ...interaction,
      reply: async (options: any) => {
        // Add back button to the tower interface
        const backButton = new ButtonBuilder()
          .setCustomId('nav_back_play')
          .setLabel('🏠 Back to Town')
          .setStyle(ButtonStyle.Secondary);
        
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
        
        // Add back button to existing components or create new ones
        const existingComponents = options.components || [];
        const newComponents = [...existingComponents, backRow];
        
        await interaction.update({
          ...options,
          components: newComponents
        });
      }
    };

    await towerCommand.visitWatchTower(mockInteraction, player, city.id);

  } catch (error) {
    console.error('Error in tower navigation:', error);
    await interaction.update({
      content: '❌ An error occurred while accessing the watch tower.',
      embeds: [],
      components: []
    });
  }
}

async function handleBackToPlay(interaction: ButtonInteraction) {
  try {
    // Execute the play command
    const playCommand = require('../commands/play');
    
    // Create a mock interaction for the play command
    const mockInteraction = {
      ...interaction,
      reply: async (options: any) => {
        await interaction.update(options);
      }
    };

    await playCommand.execute(mockInteraction);

  } catch (error) {
    console.error('Error returning to play menu:', error);
    await interaction.update({
      content: '❌ An error occurred while returning to the main menu.',
      embeds: [],
      components: []
    });
  }
}

async function handleBackToMap(interaction: ButtonInteraction) {
  try {
    // Execute the map command
    const mapCommand = require('../commands/map');
    
    // Create a mock interaction for the map command
    const mockInteraction = {
      ...interaction,
      reply: async (options: any) => {
        await interaction.update(options);
      }
    };

    await mapCommand.execute(mockInteraction);

  } catch (error) {
    console.error('Error returning to map:', error);
    await interaction.update({
      content: '❌ An error occurred while returning to the map.',
      embeds: [],
      components: []
    });
  }
}

export async function handleBankDepositSelect(interaction: StringSelectMenuInteraction) {
  try {
    const selectedValue = interaction.values[0];
    if (!selectedValue.startsWith('deposit_')) {
      await interaction.update({
        content: '❌ Invalid deposit selection.',
        embeds: [],
        components: []
      });
      return;
    }

    const itemName = selectedValue.replace('deposit_', '');
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
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Find the item by name
    const item = await itemService.getItemByName(itemName);
    if (!item) {
      await interaction.update({
        content: `❌ Item "${itemName}" not found.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has the item
    const hasItem = await inventoryService.hasItem(player.id, item.id, 1);
    if (!hasItem) {
      await interaction.update({
        content: `❌ You don't have ${item.name} in your inventory.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Remove from player inventory
    const removeSuccess = await inventoryService.removeItemFromInventory(player.id, item.id, 1);
    if (!removeSuccess) {
      await interaction.update({
        content: '❌ Failed to remove item from inventory.',
        embeds: [],
        components: []
      });
      return;
    }

    // Add to bank
    const depositSuccess = await bankService.depositItem(city.id, item.id, 1);
    if (!depositSuccess) {
      // If deposit failed, add item back to inventory
      await inventoryService.addItemToInventory(player.id, item.id, 1);
      await interaction.update({
        content: '❌ Failed to deposit item to bank.',
        embeds: [],
        components: []
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle('🏦 Item Deposited')
      .setDescription(`Successfully deposited **${item.name}** to the bank`)
      .setTimestamp();

    // Return to bank navigation
    const backButton = new ButtonBuilder()
      .setCustomId('nav_bank')
      .setLabel('🏦 Back to Bank')
      .setStyle(ButtonStyle.Primary);
    
    const playButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);

    await interaction.update({ embeds: [embed], components: [backRow] });

  } catch (error) {
    console.error('Error in bank deposit select:', error);
    await interaction.update({
      content: '❌ An error occurred while depositing the item.',
      embeds: [],
      components: []
    });
  }
}

export async function handleBankWithdrawSelect(interaction: StringSelectMenuInteraction) {
  try {
    const selectedValue = interaction.values[0];
    if (!selectedValue.startsWith('withdraw_')) {
      await interaction.update({
        content: '❌ Invalid withdraw selection.',
        embeds: [],
        components: []
      });
      return;
    }

    const itemName = selectedValue.replace('withdraw_', '');
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

    // Check if player is encumbered
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    if (isEncumbered) {
      await interaction.update({
        content: '❌ You are encumbered and cannot take items from the bank. Use `/drop <item>` to free up space first.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if taking items would make player encumbered
    const currentCount = await inventoryService.getInventoryCount(player.id);
    const maxItems = InventoryService.getMaxInventorySize();
    if (currentCount + 1 > maxItems) {
      await interaction.update({
        content: `❌ Taking 1 item would exceed your carrying capacity (${currentCount}/${maxItems}). Drop some items first.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Find bank item by name
    const bankItem = await bankService.getItemFromBankByName(city.id, itemName);
    if (!bankItem) {
      await interaction.update({
        content: `❌ Item "${itemName}" not found in the bank.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Check if bank has enough quantity
    if (bankItem.quantity < 1) {
      await interaction.update({
        content: `❌ Bank doesn't have ${bankItem.item.name}.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Remove from bank
    const withdrawSuccess = await bankService.withdrawItem(city.id, bankItem.itemId, 1);
    if (!withdrawSuccess) {
      await interaction.update({
        content: '❌ Failed to withdraw item from bank.',
        embeds: [],
        components: []
      });
      return;
    }

    // Add to player inventory
    const addSuccess = await inventoryService.addItemToInventory(player.id, bankItem.itemId, 1);
    if (!addSuccess) {
      // If adding to inventory failed, add item back to bank
      await bankService.depositItem(city.id, bankItem.itemId, 1);
      await interaction.update({
        content: '❌ Failed to add item to inventory.',
        embeds: [],
        components: []
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle('🏦 Item Withdrawn')
      .setDescription(`Successfully withdrew **${bankItem.item.name}** from the bank`)
      .setTimestamp();

    // Return to bank navigation
    const backButton = new ButtonBuilder()
      .setCustomId('nav_bank')
      .setLabel('🏦 Back to Bank')
      .setStyle(ButtonStyle.Primary);
    
    const playButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);

    await interaction.update({ embeds: [embed], components: [backRow] });

  } catch (error) {
    console.error('Error in bank withdraw select:', error);
    await interaction.update({
      content: '❌ An error occurred while withdrawing the item.',
      embeds: [],
      components: []
    });
  }
}

async function handleGateOpen(interaction: ButtonInteraction, player: any) {
  try {
    const discordId = interaction.user.id;

    // Check if player can perform action (1 AP required for gate control)
    const actionCheck = await gameEngine.canPerformAction(discordId, 1);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Control Gate')
        .setDescription(actionCheck.reason || 'Unknown error');

      const backButton = new ButtonBuilder()
        .setCustomId('nav_gate')
        .setLabel('🚪 Back to Gate')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Check if player is in city
    if (player.location !== Location.CITY) {
      await interaction.update({
        content: '❌ You must be in the city to control the gate.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    if (city.gateOpen) {
      await interaction.update({
        content: '❌ The gate is already open.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check for portal locks and horde phase restrictions
    const gameState = await gameEngine.getCurrentGameState();
    const buildings = await cityService.getCityBuildings(city.id);
    const hasPortalLock = buildings.some(b => b.type === 'portal_lock');
    
    if (hasPortalLock && gameState?.currentPhase === 'horde_mode') {
      await interaction.update({
        content: '❌ The Portal Lock prevents the gate from being opened during Horde Mode.',
        embeds: [],
        components: []
      });
      return;
    }

    // Open the gate
    const success = await cityService.updateGateStatus(city.id, true);
    if (!success) {
      await interaction.update({
        content: '❌ Failed to open the gate. Please try again.',
        embeds: [],
        components: []
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('🔓 Gate Opened')
      .setDescription(`${player.name} has opened the city gate!`)
      .addFields([
        { 
          name: '🚪 Gate Status', 
          value: '🔓 Open', 
          inline: true 
        },
        { 
          name: '✅ Effect', 
          value: 'Players can now leave and enter the city', 
          inline: true 
        }
      ])
      .setTimestamp();

    const backButton = new ButtonBuilder()
      .setCustomId('nav_gate')
      .setLabel('🚪 Back to Gate')
      .setStyle(ButtonStyle.Primary);
    
    const playButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);

    await interaction.update({ embeds: [embed], components: [backRow] });

  } catch (error) {
    console.error('Error opening gate:', error);
    await interaction.update({
      content: '❌ An error occurred while opening the gate.',
      embeds: [],
      components: []
    });
  }
}

async function handleGateClose(interaction: ButtonInteraction, player: any) {
  try {
    const discordId = interaction.user.id;

    // Check if player can perform action (1 AP required for gate control)
    const actionCheck = await gameEngine.canPerformAction(discordId, 1);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Control Gate')
        .setDescription(actionCheck.reason || 'Unknown error');

      const backButton = new ButtonBuilder()
        .setCustomId('nav_gate')
        .setLabel('🚪 Back to Gate')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Check if player is in city
    if (player.location !== Location.CITY) {
      await interaction.update({
        content: '❌ You must be in the city to control the gate.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    if (!city.gateOpen) {
      await interaction.update({
        content: '❌ The gate is already closed.',
        embeds: [],
        components: []
      });
      return;
    }

    // Close the gate
    const success = await cityService.updateGateStatus(city.id, false);
    if (!success) {
      await interaction.update({
        content: '❌ Failed to close the gate. Please try again.',
        embeds: [],
        components: []
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('🔒 Gate Closed')
      .setDescription(`${player.name} has closed the city gate!`)
      .addFields([
        { 
          name: '🚪 Gate Status', 
          value: '🔒 Closed', 
          inline: true 
        },
        { 
          name: '⚠️ Effect', 
          value: 'Players cannot leave or enter the city', 
          inline: true 
        }
      ])
      .setTimestamp();

    const backButton = new ButtonBuilder()
      .setCustomId('nav_gate')
      .setLabel('🚪 Back to Gate')
      .setStyle(ButtonStyle.Primary);
    
    const playButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);

    await interaction.update({ embeds: [embed], components: [backRow] });

  } catch (error) {
    console.error('Error closing gate:', error);
    await interaction.update({
      content: '❌ An error occurred while closing the gate.',
      embeds: [],
      components: []
    });
  }
}

async function handleGateDepart(interaction: ButtonInteraction, player: any) {
  try {
    // Use existing depart command logic
    const departCommand = require('../commands/depart');
    
    // Create a mock interaction for the depart command
    const mockInteraction = {
      ...interaction,
      reply: async (options: any) => {
        await interaction.update(options);
      }
    };

    await departCommand.execute(mockInteraction);

  } catch (error) {
    console.error('Error departing through gate:', error);
    await interaction.update({
      content: '❌ An error occurred while departing.',
      embeds: [],
      components: []
    });
  }
}

export async function handleBuildProjectSelect(interaction: StringSelectMenuInteraction) {
  try {
    const selectedValue = interaction.values[0];
    if (!selectedValue.startsWith('build_project_')) {
      await interaction.update({
        content: '❌ Invalid project selection.',
        embeds: [],
        components: []
      });
      return;
    }

    const projectId = selectedValue.replace('build_project_', '');
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
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get project details
    const constructionService = require('../services/construction').ConstructionService;
    const project = await constructionService.prototype.getProjectById.call(new constructionService(), projectId);
    
    if (!project) {
      await interaction.update({
        content: '❌ Project not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Show project details with contribution options
    const progressPercent = Math.round((project.currentApProgress / project.totalApRequired) * 100);
    
    const embed = new EmbedBuilder()
      .setColor('#8b4513')
      .setTitle(`🔨 ${project.projectName}`)
      .setDescription(project.description || 'Construction project to improve the town.')
      .addFields([
        {
          name: '📊 Progress',
          value: `${project.currentApProgress}/${project.totalApRequired} AP (${progressPercent}%)`,
          inline: true
        },
        {
          name: '🏭 Category',
          value: project.category || 'General',
          inline: true
        },
        {
          name: '💰 Cost per Contribution',
          value: '1 AP or 5 AP',
          inline: true
        }
      ])
      .setTimestamp();

    // Add material requirements if available
    if (project.materialRequirements && project.materialRequirements.length > 0) {
      const materialText = project.materialRequirements.map((req: any) => 
        `${req.itemName}: ${req.available || 0}/${req.required} ${req.available >= req.required ? '✅' : '❌'}`
      ).join('\n') || 'No materials required';
      
      embed.addFields([
        {
          name: '🔧 Material Requirements',
          value: materialText,
          inline: false
        }
      ]);
    }

    // Create contribution buttons
    const contribute1Button = new ButtonBuilder()
      .setCustomId(`build_project_1ap_${projectId}`)
      .setLabel('Contribute 1 AP')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚡');

    const contribute5Button = new ButtonBuilder()
      .setCustomId(`build_project_5ap_${projectId}`)
      .setLabel('Contribute 5 AP')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚡');

    const backToBuildButton = new ButtonBuilder()
      .setCustomId('nav_build')
      .setLabel('🔨 Back to Projects')
      .setStyle(ButtonStyle.Secondary);

    const backToPlayButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(contribute1Button, contribute5Button);
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backToBuildButton, backToPlayButton);

    await interaction.update({ 
      embeds: [embed], 
      components: [actionRow, backRow]
    });

  } catch (error) {
    console.error('Error in build project select:', error);
    await interaction.update({
      content: '❌ An error occurred while selecting the project.',
      embeds: [],
      components: []
    });
  }
}