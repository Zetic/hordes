import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';
import { ItemService } from '../models/item';
import { ZombieService } from '../services/zombieService';
import { GameEngine } from '../services/gameEngine';
import { Location, ItemType } from '../types/game';

const playerService = new PlayerService();
const inventoryService = new InventoryService();
const itemService = new ItemService();
const zombieService = ZombieService.getInstance();
const gameEngine = GameEngine.getInstance();

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

    // For now, show a simplified message that item usage is being processed
    // In the future, this would integrate with the full item effect system
    
    // Remove the item from inventory (simulating usage)
    const removeSuccess = await inventoryService.removeItemFromInventory(player.id, item.id, 1);
    if (!removeSuccess) {
      await interaction.update({
        content: `❌ Failed to use ${itemName}.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Create result embed
    const embed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle(`🎯 Used ${itemName}`)
      .setDescription(`You used ${itemName}. Item functionality is being integrated.`)
      .addFields([
        {
          name: '📦 Result',
          value: `${itemName} has been consumed from your inventory.`,
          inline: false
        }
      ])
      .setTimestamp();

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

  } catch (error) {
    console.error('Error using item:', error);
    await interaction.update({
      content: '❌ An error occurred while using the item.',
      embeds: [],
      components: []
    });
  }
}