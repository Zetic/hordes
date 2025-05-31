import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { ZombieService } from '../services/zombieService';
import { Location, ItemType } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const zombieService = ZombieService.getInstance();

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
      const discordId = interaction.user.id;
      const itemName = interaction.options.get('item')?.value as string;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in a valid location to use items
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: '❌ You cannot use items in this location. Go outside the city to use items.',
          ephemeral: true
        });
        return;
      }

      // Get the item from database
      const item = await itemService.getItemByName(itemName);
      if (!item) {
        await interaction.reply({
          content: `❌ Item "${itemName}" not found.`,
          ephemeral: true
        });
        return;
      }

      // Check if player has this item
      const playerInventory = await inventoryService.getDetailedPlayerInventory(player.id);
      const inventoryItem = playerInventory.find(inv => inv.item.id === item.id);
      
      if (!inventoryItem || inventoryItem.quantity <= 0) {
        await interaction.reply({
          content: `❌ You don't have any "${itemName}" in your inventory.`,
          ephemeral: true
        });
        return;
      }

      // Check if item is broken
      if (item.broken) {
        await interaction.reply({
          content: `❌ The ${itemName} is broken and cannot be used.`,
          ephemeral: true
        });
        return;
      }

      // Check if item can be used (has kill chance or other use properties)
      if (!item.killChance && !item.killCount) {
        await interaction.reply({
          content: `❌ The ${itemName} cannot be used.`,
          ephemeral: true
        });
        return;
      }

      // Handle Box Cutter usage
      if (item.name === 'Box Cutter') {
        await handleBoxCutterUse(interaction, player, item, inventoryItem.quantity);
      } else {
        await interaction.reply({
          content: `❌ Usage for ${itemName} is not implemented yet.`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error in use command:', error);
      await interaction.reply({
        content: '❌ An error occurred while using the item.',
        ephemeral: true
      });
    }
  }
};

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