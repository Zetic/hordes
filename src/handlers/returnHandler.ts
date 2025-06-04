import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { InventoryService } from '../models/inventory';
import { GameEngine } from '../services/gameEngine';
import { Location } from '../types/game';

const playerService = new PlayerService();
const cityService = new CityService();
const inventoryService = new InventoryService();
const gameEngine = GameEngine.getInstance();

export async function handleReturnToCityButton(interaction: ButtonInteraction) {
  try {
    const discordId = interaction.user.id;

    // Check if player can perform action (0 AP required for returning)
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

    // Check if player is already in the city
    if (player.location === Location.CITY) {
      await interaction.update({
        content: '❌ You are already in the city.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is at the gate
    if (player.location !== Location.GATE) {
      await interaction.update({
        content: '❌ You must be at the gate to return to the city. Use movement buttons to navigate to the gate first.',
        embeds: [],
        components: []
      });
      return;
    }

    // Get city
    const city = await cityService.getDefaultCity();
    if (!city) {
      await interaction.update({
        content: '❌ City not found.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if gate is open
    if (!city.gateOpen) {
      await interaction.update({
        content: '❌ The city gate is closed. You cannot enter the city.',
        embeds: [],
        components: []
      });
      return;
    }

    // Check if player is encumbered
    const isEncumbered = await inventoryService.isPlayerEncumbered(player.id);
    if (isEncumbered) {
      await interaction.update({
        content: '❌ You are encumbered and cannot enter the city. Drop some items first using the inventory commands.',
        embeds: [],
        components: []
      });
      return;
    }

    // Move player to city
    await playerService.updatePlayerLocation(discordId, Location.CITY);

    // Remove scavenging condition if present
    const { PlayerStatus } = require('../types/game');
    await playerService.removeCondition(discordId, PlayerStatus.SCAVENGING);

    // Get the play command to show town interface
    const playCommand = require('../commands/play');
    
    // Create a mock interaction for the play command that updates instead of replying
    const mockPlayInteraction = {
      ...interaction,
      user: interaction.user,
      options: {
        get: () => null
      },
      reply: async (options: any) => {
        // Show success message first, then the play interface
        const successEmbed = new EmbedBuilder()
          .setColor('#95e1d3')
          .setTitle('🏠 Returned to City')
          .setDescription(`${player.name} has returned to the safety of the city.`)
          .setTimestamp();

        // Add the town navigation to the success message
        if (options.components) {
          await interaction.update({
            embeds: [successEmbed, ...options.embeds],
            components: options.components
          });
        } else {
          await interaction.update({
            embeds: [successEmbed, ...options.embeds],
            components: []
          });
        }
      }
    };

    await playCommand.execute(mockPlayInteraction);

    // Send public message about return
    const publicEmbed = new EmbedBuilder()
      .setColor('#95e1d3')
      .setTitle(`${player.name} has returned to the city safely.`)
      .setTimestamp();

    await interaction.followUp({ embeds: [publicEmbed] });

  } catch (error) {
    console.error('Error returning to city:', error);
    await interaction.update({
      content: '❌ An error occurred while returning to the city.',
      embeds: [],
      components: []
    });
  }
}