import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
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

      // Create action rows with use buttons for each item (max 5 buttons per row, 5 rows max)
      const components: any[] = [];
      const maxButtons = 25; // Discord limit
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

      await interaction.reply({ 
        embeds: [embed], 
        components: inventory.length > 0 ? components : [],
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error in inventory command:', error);
      await interaction.reply({
        content: '❌ An error occurred while retrieving inventory.',
        ephemeral: true
      });
    }
  }
};