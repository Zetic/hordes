import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { ZombieService } from '../services/zombieService';
import { Location, ItemType } from '../types/game';
import { ItemEffectService } from '../services/itemEffectService';
import { EffectType, ItemUseContext, ItemUseResult } from '../types/itemEffects';
import { getItemDefinition } from '../data/items';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const zombieService = ZombieService.getInstance();
const effectService = ItemEffectService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Use an item from your inventory')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Name of the item to use')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    try {
      // Defer reply to handle long operations
      await interaction.deferReply();

      const discordId = interaction.user.id;
      const itemName = interaction.options.get('item')?.value as string;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.editReply({
          content: '❌ Player not found. Use `/join` to start playing.'
        });
        return;
      }

      // Check if player is in a valid location to use items
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.editReply({
          content: '❌ You cannot use items in this location. Go outside the city to use items.'
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

      // Try to use the new effect system first
      const itemDefinition = getItemDefinition(itemName);
      if (itemDefinition && itemDefinition.effects.length > 0) {
        await handleItemUseWithEffects(interaction, player, item, itemDefinition, inventoryItem.quantity);
      } else {
        // Fall back to legacy system for backward compatibility
        await handleLegacyItemUse(interaction, player, item, inventoryItem.quantity);
      }

    } catch (error) {
      console.error('Error in use command:', error);
      const replyMethod = interaction.replied || interaction.deferred ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        content: '❌ An error occurred while using the item.'
      });
    }
  }
};

async function handleItemUseWithEffects(interaction: CommandInteraction, player: any, item: any, itemDefinition: any, quantity: number) {
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
          transformInto: effectDef.transformInto
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
    
    // Process results and create response
    await constructUseResponse(interaction, player, item, results);
  } else {
    await interaction.editReply({
      content: `❌ The ${item.name} cannot be used.`
    });
  }
}

async function handleLegacyItemUse(interaction: CommandInteraction, player: any, item: any, quantity: number) {
  // Check if item can be used (has kill chance or other use properties)
  if (!item.killChance && !item.killCount) {
    await interaction.editReply({
      content: `❌ The ${item.name} cannot be used.`
    });
    return;
  }

  // Handle Box Cutter usage (legacy)
  if (item.name === 'Box Cutter') {
    await handleBoxCutterUse(interaction, player, item, quantity);
  } else {
    await interaction.editReply({
      content: `❌ Usage for ${item.name} is not implemented yet.`
    });
  }
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
  await interaction.editReply({ embeds: [embed] });
}

async function handleBoxCutterUse(interaction: CommandInteraction, player: any, item: any, quantity: number) {
  // Check if player has valid coordinates
  if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
    await interaction.reply({
      content: '❌ Invalid position. Please contact an administrator.',
      ephemeral: true
    });
    return;
  }

  // Get zombies at current location
  const zombies = await zombieService.getZombiesAtLocation(player.x, player.y);
  if (!zombies || zombies.count <= 0) {
    await interaction.reply({
      content: '🔍 There are no zombies here to attack.',
      ephemeral: true
    });
    return;
  }

  // Roll for kill chance (60%)
  const killRoll = Math.random() * 100;
  const killSuccess = killRoll <= (item.killChance || 0);

  // Roll for break chance (70%)
  const breakRoll = Math.random() * 100;
  const itemBreaks = breakRoll <= (item.breakChance || 0);

  const embed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('🔪 Box Cutter Attack')
    .setDescription(`${player.name} attacks with their Box Cutter...`);

  let resultMessage = '';

  if (killSuccess) {
    // Kill a zombie
    await zombieService.removeZombiesAtLocation(player.x, player.y, 1);
    resultMessage += '✅ You successfully killed a zombie!\n';
  } else {
    resultMessage += '❌ Your attack missed the zombie.\n';
  }

  if (itemBreaks) {
    // Remove the box cutter and add broken box cutter
    await inventoryService.removeItemFromInventory(player.id, item.id, 1);
    
    // Get or create broken box cutter
    const brokenBoxCutter = await itemService.getItemByName('Broken Box Cutter');
    if (brokenBoxCutter) {
      await inventoryService.addItemToInventory(player.id, brokenBoxCutter.id, 1);
      resultMessage += '💔 Your Box Cutter broke and is now useless!';
    } else {
      resultMessage += '💔 Your Box Cutter broke!';
    }
  } else {
    resultMessage += '🔧 Your Box Cutter survived the attack.';
  }

  embed.addFields([
    {
      name: '📊 Results',
      value: resultMessage,
      inline: false
    }
  ]);

  // Add current zombie count
  const updatedZombies = await zombieService.getZombiesAtLocation(player.x, player.y);
  const zombieCount = updatedZombies ? updatedZombies.count : 0;
  
  embed.addFields([
    {
      name: '🧟 Zombies Remaining',
      value: `${zombieCount} zombies in this area`,
      inline: false
    }
  ]);

  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}