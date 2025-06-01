import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { PlayerStatus } from '../types/game';

// IMPORTANT: No emojis must be added to any part of a command

const playerService = new PlayerService();
const cityService = new CityService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join the DIE2NITE survival game'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const discordId = interaction.user.id;
      const userName = interaction.user.displayName || interaction.user.username;

      // Check if a city exists first
      const city = await cityService.getDefaultCity();
      if (!city) {
        await interaction.reply({
          content: '❌ No town exists yet! Someone needs to create a town first using `/create town <name>`.',
          ephemeral: true
        });
        return;
      }

      // Check if player already exists
      const existingPlayer = await playerService.getPlayer(discordId);
      if (existingPlayer) {
        const statusEmojis = {
          [PlayerStatus.ALIVE]: '🧍',
          [PlayerStatus.WOUNDED_ARM]: '💪',
          [PlayerStatus.WOUNDED_EYE]: '👁️',
          [PlayerStatus.WOUNDED_FOOT]: '🦶',
          [PlayerStatus.WOUNDED_HAND]: '✋',
          [PlayerStatus.WOUNDED_HEAD]: '🧠',
          [PlayerStatus.WOUNDED_LEG]: '🦵',
          [PlayerStatus.DEAD]: '💀',
          [PlayerStatus.REFRESHED]: '💧',
          [PlayerStatus.FED]: '🍞',
          [PlayerStatus.THIRSTY]: '🫗',
          [PlayerStatus.DEHYDRATED]: '🏜️',
          [PlayerStatus.EXHAUSTED]: '😴',
          [PlayerStatus.HEALED]: '🩹',
          [PlayerStatus.INFECTED]: '🦠',
          [PlayerStatus.SCAVENGING]: '🔍'
        };
        const statusTexts = {
          [PlayerStatus.ALIVE]: 'Alive',
          [PlayerStatus.WOUNDED_ARM]: 'Wounded Arm',
          [PlayerStatus.WOUNDED_EYE]: 'Wounded Eye',
          [PlayerStatus.WOUNDED_FOOT]: 'Wounded Foot',
          [PlayerStatus.WOUNDED_HAND]: 'Wounded Hand',
          [PlayerStatus.WOUNDED_HEAD]: 'Wounded Head',
          [PlayerStatus.WOUNDED_LEG]: 'Wounded Leg',
          [PlayerStatus.DEAD]: 'Dead',
          [PlayerStatus.REFRESHED]: 'Refreshed',
          [PlayerStatus.FED]: 'Fed',
          [PlayerStatus.THIRSTY]: 'Thirsty',
          [PlayerStatus.DEHYDRATED]: 'Dehydrated',
          [PlayerStatus.EXHAUSTED]: 'Exhausted',
          [PlayerStatus.HEALED]: 'Healed',
          [PlayerStatus.INFECTED]: 'Infected',
          [PlayerStatus.SCAVENGING]: 'Scavenging'
        };

        const embed = new EmbedBuilder()
          .setColor('#ff6b6b')
          .setTitle('🧟‍♂️ Already Registered')
          .setDescription(`You're already part of the survival group, ${existingPlayer.name}!`)
          .addFields([
            { name: 'Status', value: existingPlayer.isAlive ? 'Alive' : 'Dead', inline: true },
            { name: '⚡ Action Points', value: `${existingPlayer.actionPoints}/${existingPlayer.maxActionPoints}`, inline: true }
          ])
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // Create new player
      const newPlayer = await playerService.createPlayer(discordId, userName);
      if (!newPlayer) {
        await interaction.reply({
          content: '❌ Failed to join the game. Please try again later.',
          ephemeral: true
        });
        return;
      }

      // Update city population
      if (city) {
        await cityService.updateCityPopulation(city.id);
      }

      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('🎮 Welcome to DIE2NITE!')
        .setDescription(`Welcome to the zombie apocalypse, **${newPlayer.name}**! You have joined the survivors in their fight against the undead horde.`)
        .addFields([
          { name: 'Status', value: 'Alive', inline: true },
          { name: '⚡ Action Points', value: `${newPlayer.actionPoints}/${newPlayer.maxActionPoints}`, inline: true },
          { name: '📍 Location', value: `🏠 City (Safe Zone)`, inline: true }
        ])
        .addFields([
          { 
            name: '📋 Getting Started', 
            value: '• Use `/status` to check your stats\n• Use `/explore` to search for resources\n• Use `/town` to see the town status\n• Survive the nightly zombie attacks!' 
          }
        ])
        .setFooter({ text: '💡 Tip: Work together with other survivors to build defenses and gather resources!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in join command:', error);
      await interaction.reply({
        content: '❌ An error occurred while joining the game.',
        ephemeral: true
      });
    }
  }
};