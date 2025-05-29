import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { GameEngine } from '../services/gameEngine';
import { Location } from '../types/game';

const playerService = new PlayerService();
const gameEngine = GameEngine.getInstance();

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
          .setTitle('❌ Cannot Explore')
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

      // Check if player is in city (required to explore)
      if (player.location !== Location.CITY) {
        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('❌ Cannot Explore')
          .setDescription('You must be in the city to start an exploration. Use `/return` to go back to the city first.');

        await interaction.reply({ embeds: [embed], ephemeral: true });
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

      // Generate exploration results
      const explorationResult = generateExplorationResult(area, player.health);

      const embed = new EmbedBuilder()
        .setColor('#95e1d3')
        .setTitle(`🔍 Exploration: ${area === 'greater_outside' ? '🌍 Greater Outside' : '🌲 Outside'}`)
        .setDescription(`${player.name} ventures into the dangerous wilderness...`)
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
            name: '🎲 Exploration Result', 
            value: explorationResult.description, 
            inline: false 
          }
        ]);

      // Apply results
      if (explorationResult.healthLoss > 0) {
        const newHealth = Math.max(0, player.health - explorationResult.healthLoss);
        await playerService.updatePlayerHealth(discordId, newHealth);
        
        embed.addFields([
          { 
            name: '💔 Health Lost', 
            value: `${explorationResult.healthLoss} (${player.health} → ${newHealth})`, 
            inline: true 
          }
        ]);

        if (newHealth === 0) {
          embed.setColor('#ff6b6b');
          embed.addFields([
            { 
              name: '💀 DEATH', 
              value: 'You have died from your wounds! You can no longer take actions until the next day.', 
              inline: false 
            }
          ]);
        }
      }

      if (explorationResult.resourcesFound.length > 0) {
        embed.addFields([
          { 
            name: '🎒 Resources Found', 
            value: explorationResult.resourcesFound.join('\n'), 
            inline: false 
          }
        ]);
      }

      // Add return instruction
      if (explorationResult.healthLoss === 0) {
        embed.addFields([
          { 
            name: '🏠 Returning', 
            value: 'Use `/return` to go back to the safety of the city.', 
            inline: false 
          }
        ]);
      }

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

interface ExplorationResult {
  description: string;
  healthLoss: number;
  resourcesFound: string[];
}

function generateExplorationResult(area: string, playerHealth: number): ExplorationResult {
  const isGreaterOutside = area === 'greater_outside';
  const baseDanger = isGreaterOutside ? 0.4 : 0.2;
  const random = Math.random();

  // Determine outcome based on area danger and random chance
  if (random < baseDanger) {
    // Dangerous encounter
    const healthLoss = Math.floor(Math.random() * (isGreaterOutside ? 40 : 25)) + 10;
    const encounters = isGreaterOutside 
      ? [
          'You encounter a pack of zombies and barely escape with your life!',
          'A massive zombie horde forces you to flee through dangerous terrain!',
          'You fall into a hidden pit trap and get injured by the fall and hungry zombies below!',
          'A zombie dog pack chases you through collapsed buildings!'
        ]
      : [
          'You run into a wandering zombie and fight it off!',
          'You slip and fall while fleeing from zombie sounds!',
          'A zombie surprises you from behind a tree!',
          'You get caught in old barbed wire while escaping zombies!'
        ];
    
    return {
      description: encounters[Math.floor(Math.random() * encounters.length)],
      healthLoss,
      resourcesFound: []
    };
  } else if (random < baseDanger + 0.3) {
    // Neutral outcome
    const neutralEvents = isGreaterOutside
      ? [
          'You carefully navigate through the ruins but find nothing of value.',
          'The area has been picked clean by other survivors.',
          'You spot zombies in the distance and decide to retreat.',
          'Heavy fog makes exploration too dangerous to continue.'
        ]
      : [
          'You search the area but find nothing useful.',
          'The location has already been thoroughly searched.',
          'You hear zombie groans nearby and decide to leave.',
          'The area appears to be picked clean.'
        ];

    return {
      description: neutralEvents[Math.floor(Math.random() * neutralEvents.length)],
      healthLoss: 0,
      resourcesFound: []
    };
  } else {
    // Successful exploration
    const resources: string[] = [];
    const resourceChance = isGreaterOutside ? 0.8 : 0.6;
    
    if (Math.random() < resourceChance) {
      const possibleResources = isGreaterOutside
        ? ['🪵 Sturdy Wood (2)', '🛢️ Oil Barrel', '🔧 Metal Scraps (3)', '💧 Clean Water (2)', '🔫 Weapon Parts']
        : ['🪵 Wood', '🧱 Scrap Metal', '💧 Water Bottle', '🔨 Tools', '🍖 Canned Food'];
      
      const numResources = Math.random() < 0.3 ? 2 : 1;
      for (let i = 0; i < numResources; i++) {
        const resource = possibleResources[Math.floor(Math.random() * possibleResources.length)];
        if (!resources.includes(resource)) {
          resources.push(resource);
        }
      }
    }

    const successEvents = isGreaterOutside
      ? [
          'You successfully navigate the dangerous ruins and find valuable supplies!',
          'After carefully avoiding zombie patrols, you locate an untouched supply cache!',
          'You discover a hidden stash in an abandoned building!',
          'Your cautious approach pays off as you find rare materials!'
        ]
      : [
          'You successfully scavenge the area and find useful items!',
          'Your search pays off as you discover supplies!',
          'You find an overlooked stash of resources!',
          'A thorough search reveals hidden supplies!'
        ];

    return {
      description: successEvents[Math.floor(Math.random() * successEvents.length)],
      healthLoss: 0,
      resourcesFound: resources
    };
  }
}