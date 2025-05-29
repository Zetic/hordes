import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { Location } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('take')
    .setDescription('Take an item from the ground in your current area')
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

      // Check if player is in an exploration area
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: '❌ You must be in an exploration area to take items from the ground. Use `/depart` and `/move` to venture outside the city.',
          ephemeral: true
        });
        return;
      }

      // Check if player is encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      if (isEncumbered) {
        await interaction.reply({
          content: '❌ You are encumbered and cannot take items. Use `/drop <item>` to free up space first.',
          ephemeral: true
        });
        return;
      }

      // Check if taking items would make player encumbered
      const currentCount = await inventoryService.getInventoryCount(player.id);
      const maxItems = InventoryService.getMaxInventorySize();
      if (currentCount + quantity > maxItems) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Inventory Full')
          .setDescription(`Taking ${quantity} item(s) would exceed your carrying capacity.`)
          .addFields([
            {
              name: '🎒 Current Inventory',
              value: `${currentCount}/${maxItems} items`,
              inline: true
            },
            {
              name: '💡 What you can do',
              value: `• Use \`/drop <item>\` to discard items\n• Use \`/bank deposit\` when in town`,
              inline: false
            }
          ])
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get area inventory
      const areaItems = await areaInventoryService.getAreaInventory(player.location, player.x || undefined, player.y || undefined);
      
      // Find the item by name (case insensitive)
      const foundItem = areaItems.find(item => 
        item.item.name.toLowerCase() === itemName.toLowerCase()
      );

      if (!foundItem) {
        await interaction.reply({
          content: `❌ Item "${itemName}" not found in this area.`,
          ephemeral: true
        });
        return;
      }

      // Check if there's enough quantity
      if (foundItem.quantity < quantity) {
        await interaction.reply({
          content: `❌ There are only ${foundItem.quantity} ${foundItem.item.name}(s) here, but you requested ${quantity}.`,
          ephemeral: true
        });
        return;
      }

      // Remove from area
      const removeSuccess = await areaInventoryService.removeItemFromArea(player.location, foundItem.itemId, quantity, player.x || undefined, player.y || undefined);
      if (!removeSuccess) {
        await interaction.reply({
          content: '❌ Failed to remove item from area.',
          ephemeral: true
        });
        return;
      }

      // Add to player inventory
      const addSuccess = await inventoryService.addItemToInventory(player.id, foundItem.itemId, quantity);
      if (!addSuccess) {
        // If adding to inventory failed, add item back to area
        await areaInventoryService.addItemToArea(player.location, foundItem.itemId, quantity, player.x || undefined, player.y || undefined);
        await interaction.reply({
          content: '❌ Failed to add item to inventory.',
          ephemeral: true
        });
        return;
      }

      const newInventoryCount = await inventoryService.getInventoryCount(player.id);
      
      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('📦 Item Taken')
        .setDescription(`Successfully picked up **${foundItem.item.name}** x${quantity} from the ground`)
        .addFields([
          {
            name: '🎒 Inventory Status',
            value: `${newInventoryCount}/${maxItems} items`,
            inline: false
          }
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in take command:', error);
      await interaction.reply({
        content: '❌ An error occurred while taking the item.',
        ephemeral: true
      });
    }
  }
};