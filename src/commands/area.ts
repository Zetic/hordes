import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { AreaInventoryService } from '../models/areaInventory';
import { WorldMapService } from '../services/worldMap';
import { Location } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const areaInventoryService = new AreaInventoryService();
const worldMapService = WorldMapService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('area')
    .setDescription('Display the current area without moving or using energy'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Get player
      const player = await playerService.getPlayer(discordId);
      if (!player) {
        await interaction.reply({
          content: 'Player not found. Use `/join` to start playing.',
          ephemeral: true
        });
        return;
      }

      // Check if player is in a location that can be viewed
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: 'You are in a safe location. Use `/depart` to venture outside where you can explore areas.',
          ephemeral: true
        });
        return;
      }

      // Check if player has valid coordinates
      if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
        await interaction.reply({
          content: 'Invalid position. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Defer reply since we're about to do expensive operations (map generation)
      await interaction.deferReply();

      // Get current location information
      const locationDisplay = worldMapService.getLocationDisplay(player.location);
      const areaItems = await areaInventoryService.getAreaInventory(player.location, player.x, player.y);

      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('Current Area View')
        .setDescription(`${player.name} surveys the surrounding area...`)
        .addFields([
          { 
            name: 'Current Location', 
            value: `${locationDisplay.emoji} ${locationDisplay.name} (${player.x}, ${player.y})`, 
            inline: true 
          }
        ]);

      // Add location-specific information
      if (player.location === Location.GREATER_WASTE) {
        embed.addFields([
          {
            name: 'Greater Waste',
            value: 'You are in the dangerous outer reaches. Searching here is more risky but may yield better rewards.',
            inline: false
          }
        ]);
      } else if (player.location === Location.GATE) {
        embed.addFields([
          {
            name: 'Gate Area',
            value: 'You are at the gate to town. Use `/return` to enter the city (if the gate is open).',
            inline: false
          }
        ]);
      }

      // Show map view
      const mapImageBuffer = await worldMapService.generateMapView(playerService);
      const mapAttachment = new AttachmentBuilder(mapImageBuffer, { name: 'map.png' });
      
      embed.setImage('attachment://map.png');

      // Show items in area if any
      if (areaItems.length > 0) {
        const itemList = areaItems.map(item => 
          `**${item.item.name}** x${item.quantity} - ${item.item.description}`
        ).join('\n');

        embed.addFields([
          {
            name: 'Items on the Ground',
            value: itemList,
            inline: false
          }
        ]);
      }

      embed.addFields([
        {
          name: 'Available Actions',
          value: areaItems.length > 0 
            ? '• Use `/search` to look for items (risky)\n• Use `/take <item>` to pick up items from the ground\n• Use `/move <direction>` to explore further\n• Use `/status` to check your condition'
            : '• Use `/search` to look for items (risky)\n• Use `/move <direction>` to explore further\n• Use `/status` to check your condition',
          inline: false
        }
      ]);

      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed], files: [mapAttachment] });

    } catch (error) {
      console.error('Error in area command:', error);
      
      // Check if reply was already deferred
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while viewing the area.'
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while viewing the area.',
          ephemeral: true
        });
      }
    }
  }
};