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
    .setDescription('[DEPRECATED] Use /depart and /move instead - Old exploration system')
    .addStringOption(option =>
      option.setName('area')
        .setDescription('[DEPRECATED] This command is no longer available')
        .setRequired(false)
        .addChoices(
          { name: '🚫 This command is deprecated', value: 'deprecated' }
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor('#ff6b6b')
      .setTitle('🚫 Command Deprecated')
      .setDescription('The `/explore` command has been replaced with a new grid-based exploration system!')
      .addFields([
        {
          name: '🆕 New Commands',
          value: '• Use `/depart` to leave the city through the gate\n• Use `/move <direction>` to navigate the world map\n• Use `/return` to return from the gate to the city',
          inline: false
        },
        {
          name: '🗺️ New System',
          value: 'Explore a 7x7 grid world with:\n• **Gate** - Center tile, entrance to town\n• **Waste** - Inner exploration areas\n• **Greater Waste** - Dangerous border areas',
          inline: false
        },
        {
          name: '📍 How to Start',
          value: '1. Use `/gate` to check if the gate is open\n2. Use `/depart` to leave town through the gate\n3. Use `/move north` (or other directions) to explore\n4. Use `/return` at the gate to come back to town',
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
