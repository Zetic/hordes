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
  // Implementation will be added later - placeholder for now
  const embed = new EmbedBuilder()
    .setColor('#8b4513')
    .setTitle('🔨 Construction Projects')
    .setDescription('Build projects navigation coming soon...');

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_play')
    .setLabel('🏠 Back to Town')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  
  await interaction.update({ embeds: [embed], components: [backRow] });
}

async function handleCraftNavigation(interaction: ButtonInteraction, player: any) {
  // Implementation will be added later - placeholder for now
  const embed = new EmbedBuilder()
    .setColor('#8b4513')
    .setTitle('⚒️ Crafting')
    .setDescription('Crafting navigation coming soon...');

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_play')
    .setLabel('🏠 Back to Town')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  
  await interaction.update({ embeds: [embed], components: [backRow] });
}

async function handleGateNavigation(interaction: ButtonInteraction, player: any) {
  // Implementation will be added later - placeholder for now
  const embed = new EmbedBuilder()
    .setColor('#4ecdc4')
    .setTitle('🚪 City Gate')
    .setDescription('Gate controls navigation coming soon...');

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_play')
    .setLabel('🏠 Back to Town')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  
  await interaction.update({ embeds: [embed], components: [backRow] });
}

async function handleWellNavigation(interaction: ButtonInteraction, player: any) {
  // Implementation will be added later - placeholder for now
  const embed = new EmbedBuilder()
    .setColor('#4ecdc4')
    .setTitle('💧 Town Well')
    .setDescription('Well interface navigation coming soon...');

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_play')
    .setLabel('🏠 Back to Town')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  
  await interaction.update({ embeds: [embed], components: [backRow] });
}

async function handleTowerNavigation(interaction: ButtonInteraction, player: any) {
  // Implementation will be added later - placeholder for now
  const embed = new EmbedBuilder()
    .setColor('#8b4513')
    .setTitle('🗼 Watch Tower')
    .setDescription('Tower interface navigation coming soon...');

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_play')
    .setLabel('🏠 Back to Town')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  
  await interaction.update({ embeds: [embed], components: [backRow] });
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