import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { ScavengingService } from '../services/scavenging';
import { ZombieService } from '../services/zombieService';
import { Location, PlayerStatus } from '../types/game';
import { safeInteractionReply, handleDiscordError } from '../utils/discordErrorHandler';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();
const scavengingService = ScavengingService.getInstance();
const zombieService = ZombieService.getInstance();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scavenge')
    .setDescription('Begin scavenging for items in your current area'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;

      // Check if player can perform action (1 AP required for scavenging)
      const actionCheck = await gameEngine.canPerformAction(discordId, 1);
      if (!actionCheck.canAct) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('Cannot Scavenge')
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

      // Check if player is in a valid location for scavenging
      if (player.location === Location.CITY || player.location === Location.HOME) {
        await interaction.reply({
          content: '❌ You cannot scavenge in this location. You must be outside the city.',
          ephemeral: true
        });
        return;
      }

      // Check if player is at the gate (scavenging not allowed)
      if (player.location === Location.GATE) {
        await interaction.reply({
          content: '❌ You cannot scavenge at the gate. Move to an area to begin scavenging.',
          ephemeral: true
        });
        return;
      }

      // Check if player has valid coordinates
      if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
        await interaction.reply({
          content: '❌ Invalid position. Please contact an administrator.',
          ephemeral: true
        });
        return;
      }

      // Check if player has already scavenged in this area
      const hasScavenged = await scavengingService.hasPlayerScavengedInArea(player.id, player.x, player.y);
      if (hasScavenged) {
        await interaction.reply({
          content: '❌ You have already scavenged in this area. Move to a different location to scavenge again.',
          ephemeral: true
        });
        return;
      }

      // Check if there are zombies in this area
      const zombies = await zombieService.getZombiesAtLocation(player.x, player.y);
      if (zombies && zombies.count > 0) {
        await interaction.reply({
          content: `❌ You cannot scavenge here! There are ${zombies.count} zombies preventing you from scavenging safely.`,
          ephemeral: true
        });
        return;
      }

      // Defer reply as ephemeral since we're about to do scavenging operations
      await interaction.deferReply({ ephemeral: true });

      // Perform initial scavenge
      const scavengeResult = await scavengingService.performScavenge(player.id, player.x, player.y, true);
      
      if (!scavengeResult.success) {
        await interaction.editReply({
          content: '❌ An error occurred while scavenging. Please try again.'
        });
        return;
      }

      // Add scavenging condition to player
      await playerService.addCondition(discordId, PlayerStatus.SCAVENGING);

      // Mark area as being scavenged and player as having scavenged here
      await scavengingService.markAreaAsScavenged(player.x, player.y);
      await scavengingService.markPlayerScavengedInArea(player.id, player.x, player.y);

      // Create embed for the result
      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle('🔍 Scavenging Begun')
        .setDescription(`You begin scavenging the area...`)
        .addFields([
          {
            name: '📍 Location',
            value: `${player.location} (${player.x}, ${player.y})`,
            inline: true
          },
          {
            name: '🎯 Found Item',
            value: scavengeResult.item ? `**${scavengeResult.item.name}** - ${scavengeResult.item.description}` : 'Nothing found',
            inline: false
          }
        ]);

      if (scavengeResult.item) {
        embed.addFields([
          {
            name: '📦 Item Destination',
            value: scavengeResult.addedToInventory ? 'Added to inventory' : 'Dropped on the ground (inventory full)',
            inline: true
          }
        ]);
      }

      embed.addFields([
        {
          name: '🔄 Continuous Scavenging',
          value: 'Scavenging attempts will continue automatically as long as you remain here.',
          inline: false
        },
        {
          name: '⚠️ Area Status',
          value: scavengeResult.areaInfo.isDepleted 
            ? 'Depleted of anything useful'
            : scavengeResult.areaInfo.isNearDepletion 
              ? 'Area is getting depleted. Loot quality may decrease soon.'
              : 'Area has plenty of resources.',
          inline: false
        }
      ]);

      embed.setTimestamp();

      // Add continue button to return to navigation
      const continueButton = new ButtonBuilder()
        .setCustomId('nav_back_map')
        .setLabel('🗺️ Continue Navigation')
        .setStyle(ButtonStyle.Primary);
      
      const continueRow = new ActionRowBuilder<ButtonBuilder>().addComponents(continueButton);

      await interaction.editReply({ embeds: [embed], components: [continueRow] });

    } catch (error) {
      console.error('Error in scavenge command:', error);
      
      const errorMessage = {
        content: '❌ An error occurred while scavenging.',
        ephemeral: true
      };
      
      const replied = await safeInteractionReply(interaction, errorMessage);
      if (!replied) {
        handleDiscordError(error, 'scavenge command');
      }
    }
  }
};