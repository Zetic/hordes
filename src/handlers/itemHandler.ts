import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { ZombieService } from '../services/zombieService';
import { GameEngine } from '../services/gameEngine';
import { ItemEffectService } from '../services/itemEffectService';
import { Location, ItemType } from '../types/game';
import { ItemUseContext, EffectType } from '../types/itemEffects';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const zombieService = ZombieService.getInstance();
const gameEngine = GameEngine.getInstance();
const itemEffectService = ItemEffectService.getInstance();

export async function handleUseItemButton(interaction: ButtonInteraction, itemName: string) {
  try {
    const discordId = interaction.user.id;

    // Check if player can perform action (0 AP required for using items)
    const actionCheck = await gameEngine.canPerformAction(discordId, 0);
    if (!actionCheck.canAct) {
      await interaction.update({
        content: actionCheck.reason || 'Cannot perform this action.',
        embeds: [],
        components: []
      });
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

    // Get item from database by name
    const item = await itemService.getItemByName(itemName);
    if (!item) {
      await interaction.update({
        content: `❌ Item "${itemName}" not found.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has the item in inventory
    const hasItem = await inventoryService.hasItem(player.id, item.id, 1);
    if (!hasItem) {
      await interaction.update({
        content: `❌ You don't have ${itemName} in your inventory.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Show item use interface with options
    const embed = new EmbedBuilder()
      .setColor('#4ecdc4')
      .setTitle(`🎯 Use ${itemName}`)
      .setDescription(`What would you like to do with ${itemName}?`)
      .addFields([
        {
          name: '📋 Item Description',
          value: item.description || 'No description available',
          inline: false
        },
        {
          name: '🎯 Actions Available', 
          value: 'Choose an action below:',
          inline: false
        }
      ])
      .setTimestamp();

    // Create action buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Add primary action button (drink/eat/use)
    let primaryAction = 'use';
    let primaryEmoji = '✨';
    
    // Determine the primary action based on item type or effects
    if (item.category === 'Hydration' || itemName.toLowerCase().includes('water')) {
      primaryAction = 'drink';
      primaryEmoji = '💧';
    } else if (item.category === 'Nutrition' || itemName.toLowerCase().includes('food') || itemName.toLowerCase().includes('tart')) {
      primaryAction = 'eat';
      primaryEmoji = '🍽️';
    } else if (item.effects && item.effects.some(effect => effect.type === EffectType.HEAL_PLAYER)) {
      primaryAction = 'use';
      primaryEmoji = '🩹';
    }

    const primaryButton = new ButtonBuilder()
      .setCustomId(`item_action_${primaryAction}_${itemName}`)
      .setLabel(`${primaryEmoji} ${primaryAction.charAt(0).toUpperCase() + primaryAction.slice(1)}`)
      .setStyle(ButtonStyle.Primary);

    actionRow.addComponents(primaryButton);

    // Add return to bag button
    const returnButton = new ButtonBuilder()
      .setCustomId(`item_action_return_${itemName}`)
      .setLabel('📦 Return to Bag')
      .setStyle(ButtonStyle.Secondary);

    actionRow.addComponents(returnButton);

    // Add drop button (only if player is in valid location)
    if (player.location !== Location.CITY && player.location !== Location.HOME) {
      const dropButton = new ButtonBuilder()
        .setCustomId(`item_action_drop_${itemName}`)
        .setLabel('🗑️ Drop')
        .setStyle(ButtonStyle.Danger);

      actionRow.addComponents(dropButton);
    }

    await interaction.update({ 
      embeds: [embed], 
      components: [actionRow]
    });

  } catch (error) {
    console.error('Error using item:', error);
    await interaction.update({
      content: '❌ An error occurred while using the item.',
      embeds: [],
      components: []
    });
  }
}

export async function handleItemActionButton(interaction: ButtonInteraction, action: string, itemName: string) {
  try {
    const discordId = interaction.user.id;

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

    // Get item from database by name
    const item = await itemService.getItemByName(itemName);
    if (!item) {
      await interaction.update({
        content: `❌ Item "${itemName}" not found.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Handle different actions
    switch (action) {
      case 'return':
        // Just go back to previous interface (inventory or map)
        const backButton = new ButtonBuilder()
          .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
          .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
          .setStyle(ButtonStyle.Secondary);
        
        const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

        await interaction.update({
          content: '📦 Returned to your bag.',
          embeds: [],
          components: [backRow]
        });
        break;

      case 'drop':
        await handleDropItem(interaction, player, item);
        break;

      case 'drink':
      case 'eat':
      case 'use':
        await handleConsumeItem(interaction, player, item, action);
        break;

      default:
        await interaction.update({
          content: `❌ Unknown action: ${action}`,
          embeds: [],
          components: []
        });
    }

  } catch (error) {
    console.error('Error handling item action:', error);
    await interaction.update({
      content: '❌ An error occurred while processing the item action.',
      embeds: [],
      components: []
    });
  }
}

async function handleDropItem(interaction: ButtonInteraction, player: any, item: any) {
  // Check if player can drop items in current location
  if (player.location === Location.CITY || player.location === Location.HOME) {
    await interaction.update({
      content: '❌ You cannot drop items in the city or at home.',
      embeds: [],
      components: []
    });
    return;
  }

  // Check if player has the item in inventory
  const hasItem = await inventoryService.hasItem(player.id, item.id, 1);
  if (!hasItem) {
    await interaction.update({
      content: `❌ You don't have ${item.name} in your inventory.`,
      embeds: [],
      components: []
    });
    return;
  }

  // Import AreaInventoryService
  const { AreaInventoryService } = require('../models/areaInventory');
  const areaInventoryService = new AreaInventoryService();

  // Remove from player inventory
  const removeSuccess = await inventoryService.removeItemFromInventory(player.id, item.id, 1);
  if (!removeSuccess) {
    await interaction.update({
      content: `❌ Failed to drop ${item.name}.`,
      embeds: [],
      components: []
    });
    return;
  }

  // Add to area inventory
  await areaInventoryService.addItemToArea(player.location, item.id, 1, player.x, player.y);

  const embed = new EmbedBuilder()
    .setColor('#95e1d3')
    .setTitle(`🗑️ Dropped ${item.name}`)
    .setDescription(`You dropped ${item.name} on the ground.`)
    .addFields([
      {
        name: '📍 Location',
        value: `${player.location} (${player.x}, ${player.y})`,
        inline: false
      }
    ])
    .setTimestamp();

  const backButton = new ButtonBuilder()
    .setCustomId('nav_back_map')
    .setLabel('🗺️ Back to Map')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

  await interaction.update({ 
    embeds: [embed], 
    components: [backRow]
  });
}

async function handleConsumeItem(interaction: ButtonInteraction, player: any, item: any, action: string) {
  // Check if player has the item in inventory
  const hasItem = await inventoryService.hasItem(player.id, item.id, 1);
  if (!hasItem) {
    await interaction.update({
      content: `❌ You don't have ${item.name} in your inventory.`,
      embeds: [],
      components: []
    });
    return;
  }

  // Remove the item from inventory
  const removeSuccess = await inventoryService.removeItemFromInventory(player.id, item.id, 1);
  if (!removeSuccess) {
    await interaction.update({
      content: `❌ Failed to ${action} ${item.name}.`,
      embeds: [],
      components: []
    });
    return;
  }

  // Process item effects
  let effectResults: string[] = [];
  let totalApRestored = 0;

  if (item.effects && item.effects.length > 0) {
    const context: ItemUseContext = {
      player: player,
      location: { x: player.x, y: player.y }
    };

    for (const effect of item.effects) {
      try {
        const result = await itemEffectService.executeEffect(effect, context);
        if (result.success) {
          effectResults.push(result.message);
          if (result.effectData && result.effectData.apRestored) {
            totalApRestored += result.effectData.apRestored;
          }
        } else {
          effectResults.push(result.message);
        }
      } catch (error) {
        console.error(`Error executing effect ${effect.type}:`, error);
        effectResults.push(`❌ Failed to apply ${effect.type} effect.`);
      }
    }
  }

  // Create result embed
  const actionEmoji = action === 'drink' ? '💧' : action === 'eat' ? '🍽️' : '✨';
  const actionPast = action === 'drink' ? 'drank' : action === 'eat' ? 'ate' : 'used';
  
  const embed = new EmbedBuilder()
    .setColor('#95e1d3')
    .setTitle(`${actionEmoji} ${actionPast.charAt(0).toUpperCase() + actionPast.slice(1)} ${item.name}`)
    .setDescription(`You ${actionPast} ${item.name}.`)
    .setTimestamp();

  if (effectResults.length > 0) {
    embed.addFields([{
      name: '🎯 Effects',
      value: effectResults.join('\n'),
      inline: false
    }]);
  }

  if (totalApRestored > 0) {
    embed.addFields([{
      name: '⚡ Action Points Restored',
      value: `+${totalApRestored} AP`,
      inline: true
    }]);
  }

  // Add back button based on location
  const backButton = new ButtonBuilder()
    .setCustomId(player.location === Location.CITY ? 'nav_back_play' : 'nav_back_map')
    .setLabel(player.location === Location.CITY ? '🏠 Back to Town' : '🗺️ Back to Map')
    .setStyle(ButtonStyle.Secondary);
  
  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);

  await interaction.update({ 
    embeds: [embed], 
    components: [backRow]
  });
}