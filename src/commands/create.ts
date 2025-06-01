import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { CityService } from '../models/city';
import { WorldMapService } from '../services/worldMap';
import { ZombieService } from '../services/zombieService';
import { GameEngine } from '../services/gameEngine';

// IMPORTANT: No emojis must be added to any part of a command

const cityService = new CityService();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new town')
    .addSubcommand(subcommand =>
      subcommand
        .setName('town')
        .setDescription('Create a new town for survivors')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('The name of the town')
            .setRequired(true)
        )
    ),
    
  async execute(interaction: CommandInteraction) {
    try {
      if (!interaction.isChatInputCommand()) return;
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'town') {
        const townName = interaction.options.getString('name', true);
        
        // Check if any cities already exist
        const citiesExist = await cityService.hasCities();
        if (citiesExist) {
          await interaction.reply({
            content: '❌ A town already exists! Only one town can be created at a time.',
            ephemeral: true
          });
          return;
        }
        
        // Create the new city
        const newCity = await cityService.createCity(townName);
        if (!newCity) {
          await interaction.reply({
            content: '❌ Failed to create town. Please try again later.',
            ephemeral: true
          });
          return;
        }
        
        // Initialize world map and zombies
        try {
          const worldMapService = WorldMapService.getInstance();
          const zombieService = ZombieService.getInstance();
          const gameEngine = GameEngine.getInstance();
          
          // Initialize game state for the new city
          await gameEngine.initializeGameStateForCity(newCity.id);
          
          // Reset and initialize the map
          await worldMapService.resetMap();
          
          // Initialize zombies for the new world
          await zombieService.initializeWorldZombies();
          
          console.log(`✅ Town "${townName}" created and initialized successfully`);
        } catch (initError) {
          console.error('Error initializing world systems:', initError);
          // Town was created but initialization failed - still consider success
        }
        
        const embed = new EmbedBuilder()
          .setColor('#4ecdc4')
          .setTitle('🏙️ Town Created!')
          .setDescription(`Welcome to **${newCity.name}**! A new settlement has been established for survivors.`)
          .addFields([
            { 
              name: '🏗️ Status', 
              value: 'Town created and ready for survivors', 
              inline: false 
            },
            { 
              name: '👥 Population', 
              value: '0 survivors (use `/join` to join!)', 
              inline: true 
            },
            { 
              name: '📅 Day', 
              value: '1', 
              inline: true 
            },
            { 
              name: '🛡️ Defense Level', 
              value: '0', 
              inline: true 
            }
          ])
          .addFields([
            {
              name: '📋 Next Steps',
              value: '• Survivors can now use `/join` to join the town\n• Use `/town` to check town status\n• Start building defenses with `/build`\n• Explore for resources to survive!'
            }
          ])
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in create command:', error);
      await interaction.reply({
        content: '❌ An error occurred while creating the town.',
        ephemeral: true
      });
    }
  }
};