import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { ScavengingService } from '../services/scavenging';
import { ZombieService } from '../services/zombieService';
import { Location, PlayerStatus } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();
const inventoryService = new InventoryService();
const areaInventoryService = new AreaInventoryService();
const scavengingService = ScavengingService.getInstance();
const zombieService = ZombieService.getInstance();

export async function handleScavengeButton(interaction: ButtonInteraction) {
  try {
    const discordId = interaction.user.id;

    // Check if player can perform action (1 AP required for scavenging)
    const actionCheck = await gameEngine.canPerformAction(discordId, 1);
    if (!actionCheck.canAct) {
      const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('Cannot Scavenge')
        .setDescription(actionCheck.reason || 'Unknown error');

      await interaction.update({ embeds: [embed], components: [] });
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

    // Check if player is in a valid location for scavenging
    if (player.location === Location.CITY || player.location === Location.HOME) {
      await interaction.update({
        content: '❌ You cannot scavenge in this location. You must be outside the city.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is at the gate (scavenging not allowed)
    if (player.location === Location.GATE) {
      await interaction.update({
        content: '❌ You cannot scavenge at the gate. Move to an area to begin scavenging.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has valid coordinates
    if (player.x === null || player.x === undefined || player.y === null || player.y === undefined) {
      await interaction.update({
        content: '❌ Invalid position. Please contact an administrator.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player has already scavenged in this area
    const hasScavenged = await scavengingService.hasPlayerScavengedInArea(player.id, player.x, player.y);
    if (hasScavenged) {
      await interaction.update({
        content: '❌ You have already scavenged in this area. Move to a different location to scavenge again.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if there are zombies in this area
    const zombies = await zombieService.getZombiesAtLocation(player.x, player.y);
    if (zombies && zombies.count > 0) {
      await interaction.update({
        content: `❌ You cannot scavenge here! There are ${zombies.count} zombies preventing you from scavenging safely.`,
        embeds: [],
        components: []
      });
      return;
    }

    // Perform initial scavenge
    const scavengeResult = await scavengingService.performScavenge(player.id, player.x, player.y, true);
    
    if (!scavengeResult.success) {
      await interaction.update({
        content: '❌ An error occurred while scavenging. Please try again.',
        embeds: [],
        components: []
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
      .setLabel('🔍 Continue Scavenging')
      .setStyle(ButtonStyle.Primary);
    
    const continueRow = new ActionRowBuilder<ButtonBuilder>().addComponents(continueButton);

    await interaction.update({ embeds: [embed], components: [continueRow] });

  } catch (error) {
    console.error('Error in scavenge button:', error);
    await interaction.update({
      content: '❌ An error occurred while scavenging.',
      embeds: [],
      components: []
    });
  }
}