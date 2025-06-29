import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GameEngine } from './services/gameEngine';
import { ScavengingService } from './services/scavenging';
import { safeInteractionReply, safeInteractionFollowUp, handleDiscordError } from './utils/discordErrorHandler';

config();

class Die2NiteBot {
  public client: Client;
  public commands: Collection<string, any>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    this.commands = new Collection();
    
    this.setupEventHandlers();
    this.loadCommands();
    this.setupGlobalErrorHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`🧟‍♂️ DIE2NITE Bot is ready! Logged in as ${this.client.user?.tag}`);
      
      // Initialize game engine and set Discord client
      const gameEngine = GameEngine.getInstance();
      gameEngine.setDiscordClient(this.client);
      
      // Initialize scavenging service and set Discord client
      const scavengingService = ScavengingService.getInstance();
      scavengingService.setDiscordClient(this.client);
      
      // Deploy commands on startup
      if (process.env.DISCORD_CLIENT_ID) {
        await this.deployCommands();
      } else {
        console.log('⚠️ DISCORD_CLIENT_ID not set, skipping command deployment');
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error('Error executing command:', error);
          
          const errorMessage = {
            content: 'There was an error executing this command!',
            ephemeral: true
          };

          // Use safe error handling to prevent crashes
          const replied = await safeInteractionReply(interaction, errorMessage);
          if (!replied) {
            handleDiscordError(error, `command execution (${interaction.commandName})`);
          }
        }
      } else if (interaction.isAutocomplete()) {
        const command = this.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Error handling autocomplete:', error);
        }
      } else if (interaction.isButton()) {
        // Handle button interactions
        const customId = interaction.customId;
        
        if (customId.startsWith('flee_')) {
          const { handleFleeButton } = require('./handlers/fleeHandler');
          try {
            await handleFleeButton(interaction);
          } catch (error) {
            console.error('Error handling flee button:', error);
            
            const errorMessage = {
              content: 'There was an error processing your flee attempt!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'flee button interaction');
            }
          }
        } else if (customId.startsWith('move_')) {
          const { handleMoveButton } = require('./handlers/moveHandler');
          try {
            await handleMoveButton(interaction);
          } catch (error) {
            console.error('Error handling move button:', error);
            
            const errorMessage = {
              content: 'There was an error processing your movement!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'move button interaction');
            }
          }
        } else if (customId.startsWith('use_item_')) {
          // Handle inventory use item buttons
          const itemName = customId.replace('use_item_', '');
          
          try {
            const { handleUseItemButton } = require('./handlers/itemHandler');
            await handleUseItemButton(interaction, itemName);
          } catch (error) {
            console.error('Error handling use item button:', error);
            
            const errorMessage = {
              content: 'There was an error using the item!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'use item button interaction');
            }
          }
        } else if (customId.startsWith('item_action_')) {
          // Handle item action buttons (drink, eat, drop, return)
          const parts = customId.split('_');
          const action = parts[2]; // action type: drink, eat, drop, return, use
          const itemName = parts.slice(3).join('_'); // item name (may contain underscores)
          
          try {
            const { handleItemActionButton } = require('./handlers/itemHandler');
            await handleItemActionButton(interaction, action, itemName);
          } catch (error) {
            console.error('Error handling item action button:', error);
            
            const errorMessage = {
              content: 'There was an error processing the item action!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'item action button interaction');
            }
          }
        } else if (customId.startsWith('build_project_')) {
          const { handleBuildProjectButton } = require('./handlers/buildHandler');
          try {
            await handleBuildProjectButton(interaction);
          } catch (error) {
            console.error('Error handling build project button:', error);
            
            const errorMessage = {
              content: 'There was an error processing your construction contribution!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'build project button interaction');
            }
          }
        } else if (customId === 'take_water_ration') {
          const { handleTakeWaterRationButton } = require('./handlers/visitHandler');
          try {
            await handleTakeWaterRationButton(interaction);
          } catch (error) {
            console.error('Error handling take water ration button:', error);
            
            const errorMessage = {
              content: 'There was an error taking the water ration!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'take water ration button interaction');
            }
          }
        } else if (customId === 'observe_horde') {
          const { handleObserveHordeButton } = require('./handlers/visitHandler');
          try {
            await handleObserveHordeButton(interaction);
          } catch (error) {
            console.error('Error handling observe horde button:', error);
            
            const errorMessage = {
              content: 'There was an error observing the horde!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'observe horde button interaction');
            }
          }
        } else if (customId.startsWith('craft_recipe_')) {
          const { handleCraftRecipeButton } = require('./handlers/visitHandler');
          try {
            await handleCraftRecipeButton(interaction);
          } catch (error) {
            console.error('Error handling craft recipe button:', error);
            
            const errorMessage = {
              content: 'There was an error processing the crafting request!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'craft recipe button interaction');
            }
          }
        } else if (customId.startsWith('confirm_craft_')) {
          const { handleConfirmCraftButton } = require('./handlers/visitHandler');
          try {
            await handleConfirmCraftButton(interaction);
          } catch (error) {
            console.error('Error handling confirm craft button:', error);
            
            const errorMessage = {
              content: 'There was an error confirming the crafting request!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'confirm craft button interaction');
            }
          }
        } else if (customId === 'scavenge_area') {
          // Handle scavenge button
          try {
            const { handleScavengeButton } = require('./handlers/scavengeHandler');
            await handleScavengeButton(interaction);
          } catch (error) {
            console.error('Error handling scavenge button:', error);
            
            const errorMessage = {
              content: 'There was an error while scavenging!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'scavenge button interaction');
            }
          }
        } else if (customId.startsWith('nav_')) {
          // Handle navigation buttons
          const { handleNavigationButton } = require('./handlers/navigationHandler');
          try {
            await handleNavigationButton(interaction);
          } catch (error) {
            console.error('Error handling navigation button:', error);
            
            const errorMessage = {
              content: 'There was an error with navigation!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'navigation button interaction');
            }
          }
        } else if (customId.startsWith('gate_')) {
          // Handle gate action buttons
          const { handleNavigationButton } = require('./handlers/navigationHandler');
          try {
            await handleNavigationButton(interaction);
          } catch (error) {
            console.error('Error handling gate button:', error);
            
            const errorMessage = {
              content: 'There was an error with the gate action!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'gate button interaction');
            }
          }
        } else if (customId === 'return_to_city') {
          // Handle return to city button
          try {
            const { handleReturnToCityButton } = require('./handlers/returnHandler');
            await handleReturnToCityButton(interaction);
          } catch (error) {
            console.error('Error handling return to city button:', error);
            
            const errorMessage = {
              content: 'There was an error returning to the city!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'return to city button interaction');
            }
          }
        }
      } else if (interaction.isStringSelectMenu()) {
        // Handle string select menu interactions
        const customId = interaction.customId;
        
        if (customId === 'workshop_recipe_select') {
          const { handleWorkshopRecipeSelect } = require('./handlers/visitHandler');
          try {
            await handleWorkshopRecipeSelect(interaction);
          } catch (error) {
            console.error('Error handling workshop recipe select:', error);
            
            const errorMessage = {
              content: 'There was an error processing the recipe selection!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'workshop recipe select interaction');
            }
          }
        } else if (customId === 'craft_recipe_select') {
          const { handleCraftRecipeSelect } = require('./handlers/visitHandler');
          try {
            await handleCraftRecipeSelect(interaction);
          } catch (error) {
            console.error('Error handling craft recipe select:', error);
            
            const errorMessage = {
              content: 'There was an error processing the recipe selection!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'craft recipe select interaction');
            }
          }
        } else if (customId === 'bank_deposit_select') {
          const { handleBankDepositSelect } = require('./handlers/navigationHandler');
          try {
            await handleBankDepositSelect(interaction);
          } catch (error) {
            console.error('Error handling bank deposit select:', error);
            
            const errorMessage = {
              content: 'There was an error processing the deposit!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'bank deposit select interaction');
            }
          }
        } else if (customId === 'bank_withdraw_select') {
          const { handleBankWithdrawSelect } = require('./handlers/navigationHandler');
          try {
            await handleBankWithdrawSelect(interaction);
          } catch (error) {
            console.error('Error handling bank withdraw select:', error);
            
            const errorMessage = {
              content: 'There was an error processing the withdrawal!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'bank withdraw select interaction');
            }
          }
        } else if (customId === 'build_project_select') {
          const { handleBuildProjectSelect } = require('./handlers/navigationHandler');
          try {
            await handleBuildProjectSelect(interaction);
          } catch (error) {
            console.error('Error handling build project select:', error);
            
            const errorMessage = {
              content: 'There was an error processing the project selection!',
              ephemeral: true
            };

            const replied = await safeInteractionReply(interaction, errorMessage);
            if (!replied) {
              handleDiscordError(error, 'build project select interaction');
            }
          }
        }
      }
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled Discord API errors to prevent crashes
    this.client.on('error', (error) => {
      handleDiscordError(error, 'Discord client error');
    });

    // Handle unhandled promise rejections that could be Discord errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
      
      // If it's a Discord API error, handle it gracefully
      if (typeof reason === 'object' && reason !== null) {
        handleDiscordError(reason, 'unhandled promise rejection');
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      
      // If it's a Discord API error, log it but don't exit
      if (typeof error === 'object' && error !== null) {
        handleDiscordError(error, 'uncaught exception');
        return; // Don't exit for Discord errors
      }
      
      // For non-Discord errors, exit as usual
      process.exit(1);
    });
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
      fs.mkdirSync(commandsPath, { recursive: true });
      return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.js') || file.endsWith('.ts')
    );

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          this.commands.set(command.data.name, command);
          console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
          console.log(`⚠️ Skipped invalid command file: ${file}`);
        }
      } catch (error) {
        console.error(`❌ Error loading command ${file}:`, error);
      }
    }

    console.log(`📝 Loaded ${this.commands.size} commands total`);
  }

  public async deployCommands(): Promise<void> {
    const commands = [];
    for (const command of this.commands.values()) {
      commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    try {
      console.log('🔄 Refreshing application (/) commands...');
      
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands }
      );

      console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error('❌ Error deploying commands:', error);
    }
  }

  public async start(): Promise<void> {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }
}

export default Die2NiteBot;