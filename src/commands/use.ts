import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { ZombieService } from '../services/zombieService';
import { GameEngine } from '../services/gameEngine';
import { Location, ItemType } from '../types/game';
import { ItemEffectService } from '../services/itemEffectService';
import { EffectType, ItemUseContext, ItemUseResult } from '../types/itemEffects';
import { getItemDefinition } from '../data/items';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const zombieService = ZombieService.getInstance();
const gameEngine = GameEngine.getInstance();
const effectService = ItemEffectService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item from your inventory')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Name of the item to use')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction: CommandInteraction) {
    try {
      // Defer reply to handle long operations - make it ephemeral for /use
      await interaction.deferReply({ ephemeral: true });

      const discordId = interaction.user.id;
      const itemName = interaction.options.get('item')?.value as string;

      // Check if player can perform action (0 AP required for using items)
      const actionCheck = await gameEngine.canPerformAction(discordId, 0);
      if (!actionCheck.canAct) {
        await interaction.editReply({
          content: actionCheck.reason || 'Cannot perform this action.'
        });
        return;
      }

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.editReply({
          content: '❌ Player not found. Use `/join` to start playing.'
        });
        return;
      }

      // Get the item from database
      const item = await itemService.getItemByName(itemName);
      if (!item) {
        await interaction.editReply({
          content: `❌ Item "${itemName}" not found.`
        });
        return;
      }

      // Check if player has this item
      const playerInventory = await inventoryService.getDetailedPlayerInventory(player.id);
      const inventoryItem = playerInventory.find(inv => inv.item.id === item.id);
      
      if (!inventoryItem || inventoryItem.quantity <= 0) {
        await interaction.editReply({
          content: `❌ You don't have any "${itemName}" in your inventory.`
        });
        return;
      }

      // Check if item is broken
      if (item.broken) {
        await interaction.editReply({
          content: `❌ The ${itemName} is broken and cannot be used.`
        });
        return;
      }

      // Use the new effect system only
      const itemDefinition = getItemDefinition(itemName);
      if (itemDefinition && itemDefinition.effects.length > 0) {
        await handleItemUseWithEffects(interaction, player, item, itemDefinition, inventoryItem.quantity);
      } else {
        await interaction.editReply({
          content: `❌ The ${item.name} cannot be used.`
        });
      }

    } catch (error) {
      console.error('Error in use command:', error);
      const replyMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        content: '❌ An error occurred while using the item.'
      });
    }
  },

  async autocomplete(interaction: any) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      
      if (focusedOption.name === 'item') {
        const discordId = interaction.user.id;
        
        // Get player
        const player = await playerService.getPlayer(discordId);
        if (!player) {
          await interaction.respond([]);
          return;
        }

        // Get player's inventory
        const inventory = await inventoryService.getDetailedPlayerInventory(player.id);
        
        // Filter items based on what user is typing
        const filtered = inventory
          .filter(inv => inv.item.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .slice(0, 25) // Discord limits to 25 choices
          .map(inv => ({
            name: `${inv.item.name} (x${inv.quantity})`,
            value: inv.item.name
          }));

        await interaction.respond(filtered);
      }
    } catch (error) {
      console.error('Error in use command autocomplete:', error);
      await interaction.respond([]);
    }
  }
};

async function handleItemUseWithEffects(interaction: CommandInteraction, player: any, item: any, itemDefinition: any, quantity: number) {
  // Check for status-based usage restrictions
  const statusRestrictionCheck = checkItemUsageRestrictions(player, itemDefinition);
  if (!statusRestrictionCheck.allowed) {
    await interaction.editReply({
      content: statusRestrictionCheck.reason
    });
    return;
  }

  const context: ItemUseContext = {
    player,
    location: { x: player.x, y: player.y }
  };

  const results: ItemUseResult[] = [];
  
  if (itemDefinition.effects && itemDefinition.effects.length > 0) {
    for (const effectDef of itemDefinition.effects) {
      try {
        // Convert effect definition to ItemEffect
        const effect = {
          type: effectDef.type,
          chance: effectDef.chance,
          value: effectDef.value,
          breakChance: effectDef.breakChance,
          transformInto: effectDef.transformInto,
          status: effectDef.status
        };

        const result = await effectService.executeEffect(effect, context);
        results.push(result);

        // Handle item transformation/breaking
        if (result.itemBroken) {
          await inventoryService.removeItemFromInventory(player.id, item.id, 1);
          
          if (result.transformedInto) {
            const transformedItem = await itemService.getItemByName(result.transformedInto);
            if (transformedItem) {
              await inventoryService.addItemToInventory(player.id, transformedItem.id, 1);
            }
          }
        }

      } catch (error) {
        console.error(`Error executing effect ${effectDef.type} for item ${item.name}:`, error);
        results.push({ 
          success: false, 
          message: `Failed to use ${effectDef.type} effect` 
        });
      }
    }
    
    // Remove one item from inventory if any effect succeeded and item wasn't broken
    const hasSuccessfulEffect = results.some(r => r.success);
    const itemWasBroken = results.some(r => r.itemBroken);
    
    if (hasSuccessfulEffect && !itemWasBroken) {
      await inventoryService.removeItemFromInventory(player.id, item.id, 1);
    }
    
    // Process results and create response
    await constructUseResponse(interaction, player, item, results);
  } else {
    await interaction.editReply({
      content: `❌ The ${item.name} cannot be used.`
    });
  }
}

function checkItemUsageRestrictions(player: any, itemDefinition: any): { allowed: boolean, reason?: string } {
  // Import PlayerStatus enum here to avoid circular dependency issues
  const { PlayerStatus } = require('../types/game');
  
  // Check Refreshed condition prevents Hydration items
  if (player.conditions.includes(PlayerStatus.REFRESHED) && itemDefinition.subCategory === 'Hydration') {
    return {
      allowed: false,
      reason: '❌ You cannot use hydration items while refreshed.'
    };
  }
  
  // Check Fed condition prevents Nutrition items
  if (player.conditions.includes(PlayerStatus.FED) && itemDefinition.subCategory === 'Nutrition') {
    return {
      allowed: false,
      reason: '❌ You cannot use nutrition items while fed.'
    };
  }
  
  return { allowed: true };
}

async function constructUseResponse(interaction: CommandInteraction, player: any, item: any, results: ItemUseResult[]) {
  const embed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle(`🎯 ${item.name} Usage`)
    .setDescription(`${player.name} uses their ${item.name}...`);

  let combinedMessage = '';
  let hasSuccess = false;

  for (const result of results) {
    combinedMessage += result.message + '\n';
    if (result.success) {
      hasSuccess = true;
    }
  }

  embed.addFields([
    {
      name: '📊 Results',
      value: combinedMessage.trim(),
      inline: false
    }
  ]);

  // Add current zombie count if any kill effects were used
  const hasKillEffect = results.some(r => r.effectData?.zombiesKilled !== undefined);
  if (hasKillEffect && player.x !== null && player.x !== undefined && player.y !== null && player.y !== undefined) {
    const updatedZombies = await zombieService.getZombiesAtLocation(player.x, player.y);
    const zombieCount = updatedZombies ? updatedZombies.count : 0;
    
    embed.addFields([
      {
        name: '🧟 Zombies Remaining',
        value: `${zombieCount} zombies in this area`,
        inline: false
      }
    ]);
  }

  embed.setTimestamp();
  
  // Add close bag button to return to bag view
  const closeBagButton = new ButtonBuilder()
    .setCustomId('nav_bag')
    .setLabel('🎒 Close / Back to Bag')
    .setStyle(ButtonStyle.Secondary);
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeBagButton);
  
  await interaction.editReply({ embeds: [embed], components: [buttonRow] });
}