import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { CityService } from '../models/city';
import { BankService } from '../models/bank';
import { ItemService } from '../models/item';
import { GameEngine } from '../services/gameEngine';
import { ConstructionService } from '../services/construction';
import { Location } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const cityService = new CityService();
const bankService = new BankService();
const itemService = new ItemService();
const gameEngine = GameEngine.getInstance();
const constructionService = new ConstructionService();

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
      // Check for build project contribution buttons
      if (customId.startsWith('build_project_1ap_') || customId.startsWith('build_project_5ap_')) {
        await handleBuildProjectContribution(interaction, player);
        break;
      }
      
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
      .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '📦 Close Bag / Return')
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
    const discordId = interaction.user.id;
    const targetUser = interaction.user; // Always show own status in navigation

    // Get fresh player data
    const currentPlayer = await playerService.getPlayer(discordId);
    if (!currentPlayer) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Import game types and services
    const { PlayerStatus, isWoundType } = require('../types/game');
    const WorldMapService = require('../services/worldMap').WorldMapService;
    const worldMapService = WorldMapService.getInstance();

    // Status display mappings
    const statusEmojis: { [key: string]: string } = {
      [PlayerStatus.ALIVE]: '❤️',
      [PlayerStatus.WOUNDED]: '🩸',
      [PlayerStatus.BADLY_WOUNDED]: '🩸',
      [PlayerStatus.CRITICALLY_WOUNDED]: '🩸',
      [PlayerStatus.INFECTED]: '🦠',
      [PlayerStatus.SCAVENGING]: '🔍',
      [PlayerStatus.HIDING]: '👁️',
      [PlayerStatus.DRUNK]: '🍺'
    };

    const statusTexts: { [key: string]: string } = {
      [PlayerStatus.ALIVE]: 'Healthy',
      [PlayerStatus.WOUNDED]: 'Wounded',
      [PlayerStatus.BADLY_WOUNDED]: 'Badly Wounded',
      [PlayerStatus.CRITICALLY_WOUNDED]: 'Critically Wounded',
      [PlayerStatus.INFECTED]: 'Infected',
      [PlayerStatus.SCAVENGING]: 'Scavenging',
      [PlayerStatus.HIDING]: 'Hiding',
      [PlayerStatus.DRUNK]: 'Drunk'
    };

    const locationNames: { [key: string]: string } = {
      [Location.CITY]: 'City',
      [Location.HOME]: 'Home',
      [Location.GATE]: 'Gate',
      [Location.WASTE]: 'Wasteland'
    };

    // Get location display info
    const locationDisplay = worldMapService.getLocationDisplay(currentPlayer.location);

    const embed = new EmbedBuilder()
      .setColor(currentPlayer.isAlive ? '#4ecdc4' : '#ff6b6b')
      .setTitle(`${currentPlayer.name}'s Status`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields([
        { 
          name: currentPlayer.isAlive ? '❤️ Status' : '💀 Status', 
          value: currentPlayer.isAlive ? 'Alive' : 'Dead', 
          inline: true 
        },
        ...(currentPlayer.isAlive ? [{ 
          name: '📊 Conditions', 
          value: currentPlayer.conditions.length > 0 
            ? currentPlayer.conditions.map(condition => {
                const emoji = statusEmojis[condition] || '❓';
                const text = statusTexts[condition] || condition;
                return `${emoji} ${text}`;
              }).join('\n')
            : (currentPlayer.status !== PlayerStatus.ALIVE ? 
                `${statusEmojis[currentPlayer.status] || '❓'} ${statusTexts[currentPlayer.status] || currentPlayer.status}` : 
                'No conditions'), 
          inline: true 
        }] : []),
        { 
          name: '⚡ Action Points', 
          value: `${currentPlayer.actionPoints}/${currentPlayer.maxActionPoints}`, 
          inline: true 
        },
        { 
          name: '📍 Location', 
          value: `${locationDisplay.emoji} ${locationNames[currentPlayer.location] || locationDisplay.name}${currentPlayer.x !== null && currentPlayer.y !== null ? ` (${currentPlayer.x}, ${currentPlayer.y})` : ''}`, 
          inline: true 
        },
        { 
          name: '⏰ Last Action', 
          value: `<t:${Math.floor(currentPlayer.lastActionTime.getTime() / 1000)}:R>`, 
          inline: true 
        }
      ]);

    // Add warnings for own status
    const warnings = [];
    
    // Check if player has any wound type
    const hasWound = isWoundType(currentPlayer.status) || currentPlayer.conditions.some(condition => isWoundType(condition));
    if (hasWound) {
      warnings.push('🩸 You are wounded! Another injury could be fatal.');
    }
    
    if (currentPlayer.water <= 1) warnings.push('🚨 Running out of water!');
    if (currentPlayer.actionPoints <= 2) warnings.push('💤 Low action points');
    
    if (warnings.length > 0) {
      embed.addFields([
        { name: '⚠️ Warnings', value: warnings.join('\n') }
      ]);
    }

    embed.setTimestamp();

    // Add back button based on location
    const backButton = new ButtonBuilder()
      .setCustomId(currentPlayer.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
      .setLabel(currentPlayer.location === Location.CITY ? '🏠 Back to Town' : '📊 Close Status / Return')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

    await interaction.update({
      embeds: [embed],
      components: [backRow]
    });

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
    let projects = await constructionService.getAvailableProjects(city.id);
    
    // If no projects exist, initialize default projects
    if (projects.length === 0) {
      await constructionService.initializeDefaultProjects(city.id);
      projects = await constructionService.getAvailableProjects(city.id);
    }

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
    // Crafting temporarily disabled
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('🚧 Crafting Temporarily Disabled')
      .setDescription('Crafting functionality has been temporarily disabled during the navigation system overhaul. Please check back later.');
    
    const backButton = new ButtonBuilder()
      .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
      .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    
    await interaction.update({ embeds: [embed], components: [backRow] });

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

    // Initialize well if needed
    await constructionService.initializeWell(city.id);
    
    // Get well water info
    const wellWater = await constructionService.getWellWater(city.id);
    if (!wellWater) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('❌ Well Error')
        .setDescription('Unable to access well information.');
      
      const backButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);
      
      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
      
      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }

    // Check water ration status without taking water
    const { canTake, message, rationsTaken } = await constructionService.checkWaterRationStatus(player.id, city.id);

    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle('💧 Town Well')
      .setDescription('The town\'s water source. Clean, fresh water is available for all survivors.')
      .addFields([
        {
          name: '💧 Water Available',
          value: `${wellWater.currentWater} rations`,
          inline: true
        },
        {
          name: '🚰 Daily Limit',
          value: 'You can take 1 ration per day', // TODO: Update this based on pump
          inline: true
        },
        {
          name: '📅 Today\'s Usage',
          value: `You have taken ${rationsTaken} ration(s) today`,
          inline: true
        }
      ]);

    const components: any[] = [];

    // Create take water button
    if (wellWater.currentWater > 0 && canTake) {
      const takeWaterButton = new ButtonBuilder()
        .setCustomId('take_water_ration')
        .setLabel('💧 Take Water Ration')
        .setStyle(ButtonStyle.Primary);
      
      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(takeWaterButton);
      components.push(actionRow);
    }

    if (wellWater.currentWater <= 0) {
      embed.addFields([{
        name: '⚠️ No Water Available',
        value: 'The well is currently empty. Wait for it to refill or for someone to build a pump.',
        inline: false
      }]);
    } else {
      embed.addFields([{
        name: '💧 Fresh Water',
        value: 'Press the button below to take a water ration if you haven\'t already taken your daily allowance.',
        inline: false
      }]);
    }

    // Add back button
    const backButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
    components.push(backRow);

    await interaction.update({ 
      embeds: [embed], 
      components: components
    });

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
    const hasWatchTower = allBuildings.some(b => b.type === 'watchtower' && b.isVisitable);

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

    // Show tower interface directly
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
    const observeButton = new ButtonBuilder()
      .setCustomId('observe_horde')
      .setLabel('🔭 Observe Horde Activity')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(observeButton);

    // Add back button
    const backButton = new ButtonBuilder()
      .setCustomId('nav_back_play')
      .setLabel('🏠 Back to Town')
      .setStyle(ButtonStyle.Secondary);
    
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

    await interaction.update({ 
      embeds: [embed], 
      components: [actionRow, backRow]
    });

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
    const discordId = interaction.user.id;
    const playerService = require('../models/player').PlayerService;
    const worldMapService = require('../services/worldMap').WorldMapService;
    const createAreaEmbed = require('../utils/embedUtils').createAreaEmbed;
    const Location = require('../types/game').Location;

    const playerServiceInstance = new playerService();
    const worldMapServiceInstance = worldMapService.getInstance();

    // Get player
    const player = await playerServiceInstance.getPlayer(discordId);
    if (!player) {
      await interaction.update({
        content: '❌ Player not found. Use `/join` to start playing.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is in a location that can be viewed
    if (player.location === Location.CITY || player.location === Location.HOME) {
      await interaction.update({
        content: '❌ You are in a safe location. Use `/depart` to venture outside where you can explore areas.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has valid coordinates
    if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
      await interaction.update({
        content: '❌ Invalid position. Please contact an administrator.',
        embeds: [],
        components: []
      });
      return;
    }

    // Generate map view
    const mapImageBuffer = await worldMapServiceInstance.generateMapView(playerServiceInstance);
    
    // Create standardized area embed
    const { embed, attachment, components } = await createAreaEmbed({
      player,
      title: 'Current Area View',
      description: `${player.name} surveys the surrounding area...`,
      showMovement: true,  // Map command should show movement buttons for exploration
      showScavenge: true,  // Show scavenge button if available
      showGateOptions: player.location === Location.GATE, // Show bag and return buttons if at gate
      mapImageBuffer
    });

    // Add location-specific information for gate
    if (player.location === Location.GATE) {
      embed.addFields([
        {
          name: '🚪 Gate Area',
          value: 'You are at the gate to town. Use the return button to enter the city (if the gate is open).',
          inline: false
        }
      ]);
    }

    await interaction.update({ embeds: [embed], files: [attachment], components });

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

    // Update the gate navigation to show the new status
    await handleGateNavigation(interaction, player);

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

    // Update the gate navigation to show the new status
    await handleGateNavigation(interaction, player);

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
    const discordId = interaction.user.id;

    // Check if player is in city
    if (player.location !== Location.CITY) {
      await interaction.update({
        content: '❌ You must be in the city to depart.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city to check gate status
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if gate is open
    if (!city.gateOpen) {
      await interaction.update({
        content: '❌ The city gate is closed. You cannot leave the city.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is encumbered
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    if (isEncumbered) {
      await interaction.update({
        content: '❌ You are encumbered and cannot depart. Use the bag navigation to drop items first.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get gate coordinates
    const WorldMapService = require('../services/worldMap').WorldMapService;
    const worldMapService = WorldMapService.getInstance();
    const gateCoords = worldMapService.getGateCoordinates();

    // Update player location to gate
    await playerService.updatePlayerLocation(discordId, Location.GATE, gateCoords.x, gateCoords.y);

    // Get updated player with new location
    const updatedPlayer = await playerService.getPlayer(discordId);
    if (!updatedPlayer) {
      await interaction.update({
        content: '❌ Error retrieving updated player data.',
        embeds: [],
        components: []
      });
      return;
    }

    // Generate map view
    const mapImageBuffer = await worldMapService.generateMapView(playerService);
    
    // Get location display info
    const createAreaEmbed = require('../utils/embedUtils').createAreaEmbed;
    const { embed, attachment, components } = await createAreaEmbed({
      player: updatedPlayer,
      title: '🚪 Departed from City',
      description: `${updatedPlayer.name} has left the safety of the city and stands at the gate...`,
      showMovement: true,
      showScavenge: false,  // No scavenging at gate
      showGateOptions: true, // Show return and bag buttons at gate
      mapImageBuffer
    });

    await interaction.update({ embeds: [embed], files: [attachment], components });

    // Send public message
    const publicEmbed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle(`${updatedPlayer.name} has departed from the city and heads out into the wasteland...`)
      .setTimestamp();

    await interaction.followUp({ embeds: [publicEmbed] });

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
    const project = await constructionService.getProject(projectId);
    
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

async function handleBuildProjectContribution(interaction: ButtonInteraction, player: any) {
  try {
    const customId = interaction.customId;
    const projectId = customId.split('_').slice(-1)[0]; // Get project ID from end
    const apAmount = customId.includes('1ap') ? 1 : 5;
    const discordId = interaction.user.id;

    // Check if player can perform action
    const actionCheck = await gameEngine.canPerformAction(discordId, apAmount);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Contribute')
        .setDescription(actionCheck.reason || 'Unknown error');

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // Check if player is in town
    if (player.location !== Location.CITY) {
      await interaction.update({
        content: '❌ You must be in town to contribute to construction projects.',
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
    const project = await constructionService.getProject(projectId);
    
    if (!project) {
      await interaction.update({
        content: '❌ Project not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if project is already completed
    if (project.isCompleted) {
      await interaction.update({
        content: '❌ This project has already been completed.',
        embeds: [],
        components: []
      });
      return;
    }

    // Contribute AP to the project
    const contributionResult = await constructionService.addApToProject(projectId, apAmount);
    
    if (!contributionResult) {
      await interaction.update({
        content: `❌ Failed to contribute to project.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Deduct action points
    await playerService.updatePlayerActionPoints(discordId, player.actionPoints - apAmount);

    // Get updated project details
    const updatedProject = await constructionService.getProject(projectId);
    
    if (!updatedProject) {
      await interaction.update({
        content: '❌ Failed to get updated project details.',
        embeds: [],
        components: []
      });
      return;
    }
    
    if (updatedProject.isCompleted) {
      // Project is now completed
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Project Completed!')
        .setDescription(`**${updatedProject.projectName}** has been completed!`)
        .addFields([
          {
            name: '✅ Contribution',
            value: `You contributed ${apAmount} AP to complete this project`,
            inline: true
          },
          {
            name: '🏗️ Status',
            value: 'Project is now complete and operational',
            inline: true
          }
        ])
        .setTimestamp();

      const backButton = new ButtonBuilder()
        .setCustomId('nav_build')
        .setLabel('🔨 Back to Projects')
        .setStyle(ButtonStyle.Primary);

      const playButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);

      await interaction.update({ embeds: [embed], components: [backRow] });
      
      // Send public completion message
      const publicEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Construction Complete')
        .setDescription(`**${updatedProject.projectName}** has been completed by ${player.name}!`);

      await interaction.followUp({ embeds: [publicEmbed] });
    } else {
      // Project still in progress, show updated status
      const progressPercent = Math.round((updatedProject.currentApProgress / updatedProject.totalApRequired) * 100);
      
      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('⚡ Contribution Successful')
        .setDescription(`You contributed ${apAmount} AP to **${updatedProject.projectName}**`)
        .addFields([
          {
            name: '📊 Updated Progress',
            value: `${updatedProject.currentApProgress}/${updatedProject.totalApRequired} AP (${progressPercent}%)`,
            inline: true
          },
          {
            name: '⚡ Remaining AP',
            value: `${player.actionPoints - apAmount}/10`,
            inline: true
          }
        ])
        .setTimestamp();

      // Add contribution buttons if player still has AP and project isn't complete
      const components: any[] = [];
      
      if (player.actionPoints - apAmount >= 1 && updatedProject.currentApProgress < updatedProject.totalApRequired) {
        const contribute1Button = new ButtonBuilder()
          .setCustomId(`build_project_1ap_${projectId}`)
          .setLabel('Contribute 1 AP')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡');

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(contribute1Button);
        
        if (player.actionPoints - apAmount >= 5) {
          const contribute5Button = new ButtonBuilder()
            .setCustomId(`build_project_5ap_${projectId}`)
            .setLabel('Contribute 5 AP')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚡');
            
          actionRow.addComponents(contribute5Button);
        }
        
        components.push(actionRow);
      }

      const backButton = new ButtonBuilder()
        .setCustomId('nav_build')
        .setLabel('🔨 Back to Projects')
        .setStyle(ButtonStyle.Secondary);

      const playButton = new ButtonBuilder()
        .setCustomId('nav_back_play')
        .setLabel('🏠 Back to Town')
        .setStyle(ButtonStyle.Secondary);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, playButton);
      components.push(backRow);

      await interaction.update({ embeds: [embed], components });
      
      // Send public contribution message
      const publicEmbed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setDescription(`${player.name} contributed ${apAmount} AP to **${updatedProject.projectName}** (${progressPercent}% complete)`);

      await interaction.followUp({ embeds: [publicEmbed] });
    }

  } catch (error) {
    console.error('Error in build project contribution:', error);
    await interaction.update({
      content: '❌ An error occurred while contributing to the project.',
      embeds: [],
      components: []
    });
  }
}