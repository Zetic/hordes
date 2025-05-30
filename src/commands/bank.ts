import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { BankService } from '../models/bank';
import { CityService } from '../models/city';
import { Location } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const bankService = new BankService();
const cityService = new CityService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Interact with the town bank')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View items in the bank')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deposit')
        .setDescription('Deposit an item into the bank')
        .addStringOption(option =>
          option.setName('item')
            .setDescription('Name of the item to deposit')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('How many to deposit (default: 1)')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('take')
        .setDescription('Take an item from the bank')
        .addStringOption(option =>
          option.setName('item')
            .setDescription('Name of the item to take')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('quantity')
            .setDescription('How many to take (default: 1)')
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const subcommand = interaction.options.data.find(option => option.type === 1)?.name || 'view';

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in town
      if (player.location !== Location.CITY) {
        await interaction.reply({
          content: '❌ You must be in town to access the bank. Use `/return` to go back to town.',
          ephemeral: true
        });
        return;
      }

      // Get city
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ City not found.',
          ephemeral: true
        });
        return;
      }

      switch (subcommand) {
        case 'view':
          await handleViewBank(interaction, city.id);
          break;
        case 'deposit':
          await handleDepositItem(interaction, player.id, city.id);
          break;
        case 'take':
          await handleTakeItem(interaction, player.id, city.id);
          break;
        default:
          // Default to view when no subcommand is provided
          await handleViewBank(interaction, city.id);
          break;
      }

    } catch (error) {
      console.error('Error in bank command:', error);
      await interaction.reply({
        content: '❌ An error occurred while accessing the bank.',
        ephemeral: true
      });
    }
  }
};

async function handleViewBank(interaction: CommandInteraction, cityId: string) {
  const bankInventory = await bankService.getBankInventory(cityId);

  const embed = new EmbedBuilder()
    .setColor('#ffd93d')
    .setTitle('🏦 Town Bank')
    .setDescription('Items stored in the community bank');

  if (bankInventory.length === 0) {
    embed.addFields([
      {
        name: '📦 Bank Contents',
        value: 'The bank is empty',
        inline: false
      }
    ]);
  } else {
    const itemList = bankInventory.map(inv => 
      `**${inv.item.name}** x${inv.quantity} - ${inv.item.description}`
    ).join('\n');

    embed.addFields([
      {
        name: '📦 Bank Contents',
        value: itemList,
        inline: false
      }
    ]);
  }

  embed.addFields([
    {
      name: '💡 Usage',
      value: 'Use `/bank deposit <item>` to store items or `/bank take <item>` to retrieve items.',
      inline: false
    }
  ]);

  embed.setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleDepositItem(interaction: CommandInteraction, playerId: string, cityId: string) {
  const itemName = interaction.options.get('item')?.value as string;
  const quantity = interaction.options.get('quantity')?.value as number || 1;

  // Find the item by name
  const item = await itemService.getItemByName(itemName);
  if (!item) {
    await interaction.reply({
      content: `❌ Item "${itemName}" not found.`,
      ephemeral: true
    });
    return;
  }

  // Check if player has the item
  const hasItem = await inventoryService.hasItem(playerId, item.id, quantity);
  if (!hasItem) {
    await interaction.reply({
      content: `❌ You don't have ${quantity} ${item.name}(s) in your inventory.`,
      ephemeral: true
    });
    return;
  }

  // Remove from player inventory
  const removeSuccess = await inventoryService.removeItemFromInventory(playerId, item.id, quantity);
  if (!removeSuccess) {
    await interaction.reply({
      content: '❌ Failed to remove item from inventory.',
      ephemeral: true
    });
    return;
  }

  // Add to bank
  const depositSuccess = await bankService.depositItem(cityId, item.id, quantity);
  if (!depositSuccess) {
    // If deposit failed, add item back to inventory
    await inventoryService.addItemToInventory(playerId, item.id, quantity);
    await interaction.reply({
      content: '❌ Failed to deposit item to bank.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#95e1d3')
    .setTitle('🏦 Item Deposited')
    .setDescription(`Successfully deposited **${item.name}** x${quantity} to the bank`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleTakeItem(interaction: CommandInteraction, playerId: string, cityId: string) {
  const itemName = interaction.options.get('item')?.value as string;
  const quantity = interaction.options.get('quantity')?.value as number || 1;

  // Check if player is encumbered
  const isEncumbered = await inventoryService.isPlayerEncumbered(playerId);
  if (isEncumbered) {
    await interaction.reply({
      content: '❌ You are encumbered and cannot take items from the bank. Use `/drop <item>` to free up space first.',
      ephemeral: true
    });
    return;
  }

  // Check if taking items would make player encumbered
  const currentCount = await inventoryService.getInventoryCount(playerId);
  const maxItems = InventoryService.getMaxInventorySize();
  if (currentCount + quantity > maxItems) {
    await interaction.reply({
      content: `❌ Taking ${quantity} item(s) would exceed your carrying capacity (${currentCount}/${maxItems}). Drop some items first.`,
      ephemeral: true
    });
    return;
  }

  // Find bank item by name
  const bankItem = await bankService.getItemFromBankByName(cityId, itemName);
  if (!bankItem) {
    await interaction.reply({
      content: `❌ Item "${itemName}" not found in the bank.`,
      ephemeral: true
    });
    return;
  }

  // Check if bank has enough quantity
  if (bankItem.quantity < quantity) {
    await interaction.reply({
      content: `❌ Bank only has ${bankItem.quantity} ${bankItem.item.name}(s), but you requested ${quantity}.`,
      ephemeral: true
    });
    return;
  }

  // Remove from bank
  const withdrawSuccess = await bankService.withdrawItem(cityId, bankItem.itemId, quantity);
  if (!withdrawSuccess) {
    await interaction.reply({
      content: '❌ Failed to withdraw item from bank.',
      ephemeral: true
    });
    return;
  }

  // Add to player inventory
  const addSuccess = await inventoryService.addItemToInventory(playerId, bankItem.itemId, quantity);
  if (!addSuccess) {
    // If adding to inventory failed, add item back to bank
    await bankService.depositItem(cityId, bankItem.itemId, quantity);
    await interaction.reply({
      content: '❌ Failed to add item to inventory.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#95e1d3')
    .setTitle('🏦 Item Taken')
    .setDescription(`Successfully took **${bankItem.item.name}** x${quantity} from the bank`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}