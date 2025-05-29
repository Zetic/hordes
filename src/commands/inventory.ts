import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { InventoryService } from '../models/inventory';

const playerService = new PlayerService();
const inventoryService = new InventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory or another player\'s inventory')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('Player to view inventory for (optional)')
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    try {
      const targetUser = interaction.options.get('player')?.user || interaction.user;
      const discordId = targetUser.id;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: `❌ Player ${targetUser.username} not found. They need to use \`/join\` to start playing.`,
          ephemeral: true
        });
        return;
      }

      // Get detailed inventory
      const inventory = await inventoryService.getDetailedPlayerInventory(player.id);
      const inventoryCount = await inventoryService.getInventoryCount(player.id);
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      const maxItems = InventoryService.getMaxInventorySize();

      const embed = new EmbedBuilder()
        .setColor(isEncumbered ? '#ff6b6b' : '#95e1d3')
        .setTitle(`🎒 ${player.name}'s Inventory`)
        .setDescription(`Carrying ${inventoryCount}/${maxItems} items${isEncumbered ? ' - **ENCUMBERED**' : ''}`);

      if (inventory.length === 0) {
        embed.addFields([
          {
            name: '📦 Items',
            value: 'Inventory is empty',
            inline: false
          }
        ]);
      } else {
        const itemList = inventory.map(inv => 
          `**${inv.item.name}** x${inv.quantity} - ${inv.item.description}`
        ).join('\n');

        embed.addFields([
          {
            name: '📦 Items',
            value: itemList,
            inline: false
          }
        ]);
      }

      if (isEncumbered) {
        embed.addFields([
          {
            name: '⚠️ Encumbered',
            value: 'You are carrying too many items! Use `/drop <item>` to drop an item before you can `/explore` or `/return`.',
            inline: false
          }
        ]);
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in inventory command:', error);
      await interaction.reply({
        content: '❌ An error occurred while retrieving inventory.',
        ephemeral: true
      });
    }
  }
};