import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { BankService } from '../models/bank';
import { AreaInventoryService } from '../models/areaInventory';
import { CityService } from '../models/city';
import { Location } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const bankService = new BankService();
const areaInventoryService = new AreaInventoryService();
const cityService = new CityService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Drop an item from your inventory')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Name of the item to drop')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option.setName('quantity')
        .setDescription('How many to drop (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const itemName = interaction.options.get('item')?.value as string;
      const quantity = interaction.options.get('quantity')?.value as number || 1;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

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
      const hasItem = await inventoryService.hasItem(player.id, item.id, quantity);
      if (!hasItem) {
        await interaction.reply({
          content: `❌ You don't have ${quantity} ${item.name}(s) in your inventory.`,
          ephemeral: true
        });
        return;
      }

      // Remove item from player inventory
      const removeSuccess = await inventoryService.removeItemFromInventory(player.id, item.id, quantity);
      if (!removeSuccess) {
        await interaction.reply({
          content: '❌ Failed to remove item from inventory.',
          ephemeral: true
        });
        return;
      }

      let depositLocation = '';
      let depositSuccess = false;

      if (player.location === Location.CITY) {
        // In town - drop goes to bank
        const city = await cityService.getDefaultCity();
        if (city) {
          depositSuccess = await bankService.depositItem(city.id, item.id, quantity);
          depositLocation = 'town bank';
        }
      } else {
        // Outside town - drop goes to area inventory
        depositSuccess = await areaInventoryService.addItemToArea(player.location, item.id, quantity, player.x || undefined, player.y || undefined);
        const locationName = player.location === Location.GREATER_WASTE ? 'Greater Waste' : 
                           player.location === Location.WASTE ? 'Waste' : 
                           player.location === Location.GATE ? 'Gate' : 'Outside Area';
        depositLocation = locationName;
      }

      if (!depositSuccess) {
        // If we failed to deposit, add the item back to inventory
        await inventoryService.addItemToInventory(player.id, item.id, quantity);
        await interaction.reply({
          content: '❌ Failed to drop item. Try again.',
          ephemeral: true
        });
        return;
      }

      // Check if player is no longer encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      const inventoryCount = await inventoryService.getInventoryCount(player.id);
      const maxItems = InventoryService.getMaxInventorySize();

      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('📦 Item Dropped')
        .setDescription(`Dropped **${item.name}** x${quantity} in ${depositLocation}`)
        .addFields([
          {
            name: '🎒 Inventory Status',
            value: `${inventoryCount}/${maxItems} items${isEncumbered ? ' - Still encumbered' : ' - Can move freely'}`,
            inline: false
          }
        ]);

      if (!isEncumbered) {
        embed.addFields([
          {
            name: '✅ Freedom of Movement',
            value: 'You are no longer encumbered and can use `/explore` and `/return` commands.',
            inline: false
          }
        ]);
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in drop command:', error);
      await interaction.reply({
        content: '❌ An error occurred while dropping the item.',
        ephemeral: true
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
      console.error('Error in drop command autocomplete:', error);
      await interaction.respond([]);
    }
  }
};