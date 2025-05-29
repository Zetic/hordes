import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { Location, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('explore')
    .setDescription('Explore outside the city to find resources')
    .addStringOption(option =>
      option.setName('area')
        .setDescription('Area to explore')
        .setRequired(false)
        .addChoices(
          { name: '🌲 Outside (Nearby areas)', value: 'outside' },
          { name: '🌍 Greater Outside (Distant areas)', value: 'greater_outside' }
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const area = interaction.options.get('area')?.value as string || 'outside';

      // Check if player can perform action
      const actionCheck = await gameEngine.canPerformAction(discordId);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Explore')
          .setDescription(actionCheck.reason || 'Unknown error');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: '❌ Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is encumbered
      const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
      if (isEncumbered) {
        await interaction.reply({
          content: '❌ You are encumbered and cannot explore. Use `/drop <item>` to free up space first.',
          ephemeral: true
        });
        return;
      }

      // Spend action points
      const actionCost = area === 'greater_outside' ? 2 : 1;
      const success = await playerService.spendActionPoints(discordId, actionCost);
      if (!success) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Insufficient Action Points')
          .setDescription(`You need ${actionCost} action points to explore this area.`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Update player location
      const targetLocation = area === 'greater_outside' ? Location.GREATER_OUTSIDE : Location.OUTSIDE;
      await playerService.updatePlayerLocation(discordId, targetLocation);

      // Get items in the area
      const areaItems = await areaInventoryService.getAreaInventory(targetLocation);
      
      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle(`🔍 Exploration: ${area === 'greater_outside' ? '🌍 Greater Outside' : '🌲 Outside'}`)
        .setDescription(`${player.name} travels safely to the exploration area...`)
        .addFields([
          { 
            name: '📍 Location', 
            value: area === 'greater_outside' ? 'Greater Outside (Very Dangerous)' : 'Outside (Dangerous)', 
            inline: true 
          },
          { 
            name: '⚡ Action Points Used', 
            value: `${actionCost}`, 
            inline: true 
          },
          { 
            name: '✅ Safe Arrival', 
            value: 'You have arrived safely at the exploration area. Moving to an area is always safe.', 
            inline: false 
          }
        ]);

      // Show items left behind if any
      if (areaItems.length > 0) {
        const itemList = areaItems.map(item => 
          `**${item.item.name}** x${item.quantity} - ${item.item.description}`
        ).join('\n');

        embed.addFields([
          {
            name: '📦 Items Left Behind',
            value: itemList,
            inline: false
          },
          {
            name: '💡 Tip',
            value: 'Use `/take <item>` to pick up items from the ground.',
            inline: false
          }
        ]);
      }

      embed.addFields([
        {
          name: '🔍 Next Steps',
          value: 'Use `/search` to look for new items (risky) or `/return` to go back to town safely.',
          inline: false
        }
      ]);

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in explore command:', error);
      await interaction.reply({
        content: '❌ An error occurred while exploring.',
        ephemeral: true
      });
    }
  }
};
