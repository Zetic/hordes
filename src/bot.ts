import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GameEngine } from './services/gameEngine';
import { ScavengingService } from './services/scavenging';

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

          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
            }
          }
        } else if (customId.startsWith('use_item_')) {
          // Handle inventory use item buttons
          const itemName = customId.replace('use_item_', '');
          const useCommand = this.commands.get('use');
          
          if (useCommand) {
            try {
              // Create a mock command interaction for the use command
              const mockInteraction = {
                ...interaction,
                isChatInputCommand: () => true,
                isButton: () => false,
                commandName: 'use',
                options: {
                  get: (name: string) => {
                    if (name === 'item') {
                      return { value: itemName };
                    }
                    return null;
                  }
                },
                deferReply: async () => {
                  if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply();
                  }
                },
                editReply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                },
                reply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                }
              };
              
              await useCommand.execute(mockInteraction);
            } catch (error) {
              console.error('Error handling use item button:', error);
              
              const errorMessage = {
                content: 'There was an error using the item!',
                ephemeral: true
              };

              if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
              } else {
                await interaction.reply(errorMessage);
              }
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
            }
          }
        } else if (customId === 'scavenge_area') {
          // Handle scavenge button
          const scavengeCommand = this.commands.get('scavenge');
          
          if (scavengeCommand) {
            try {
              // Create a mock command interaction for the scavenge command
              const mockInteraction = {
                ...interaction,
                isChatInputCommand: () => true,
                isButton: () => false,
                commandName: 'scavenge',
                options: {
                  get: () => null
                },
                deferReply: async (options: any = {}) => {
                  if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply(options);
                  }
                },
                editReply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                },
                reply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                }
              };
              
              await scavengeCommand.execute(mockInteraction);
            } catch (error) {
              console.error('Error handling scavenge button:', error);
              
              const errorMessage = {
                content: 'There was an error while scavenging!',
                ephemeral: true
              };

              if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
              } else {
                await interaction.reply(errorMessage);
              }
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
            }
          }
        } else if (customId === 'return_to_city') {
          // Handle return to city button
          const returnCommand = this.commands.get('return');
          const playCommand = this.commands.get('play');
          
          if (returnCommand && playCommand) {
            try {
              // Create a mock command interaction for the return command
              const mockReturnInteraction = {
                ...interaction,
                isChatInputCommand: () => true,
                isButton: () => false,
                commandName: 'return',
                options: {
                  get: () => null
                },
                deferReply: async (options: any = {}) => {
                  if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply(options);
                  }
                },
                editReply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                },
                reply: async (content: any) => {
                  if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(content);
                  } else {
                    return await interaction.reply(content);
                  }
                },
                followUp: async (content: any) => {
                  // Ignore the followUp from return command to avoid extra messages
                  return;
                }
              };
              
              // First execute return command to move player back to city
              await returnCommand.execute(mockReturnInteraction);
              
              // Then execute play command to show town interface
              const mockPlayInteraction = {
                ...interaction,
                isChatInputCommand: () => true,
                isButton: () => false,
                commandName: 'play',
                options: {
                  get: () => null
                },
                deferReply: async (options: any = {}) => {
                  // Already deferred by return command
                },
                editReply: async (content: any) => {
                  return await interaction.editReply(content);
                },
                reply: async (content: any) => {
                  return await interaction.editReply(content);
                }
              };
              
              await playCommand.execute(mockPlayInteraction);
              
            } catch (error) {
              console.error('Error handling return to city button:', error);
              
              const errorMessage = {
                content: 'There was an error returning to the city!',
                ephemeral: true
              };

              if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
              } else {
                await interaction.reply(errorMessage);
              }
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
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

            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(errorMessage);
            } else {
              await interaction.reply(errorMessage);
            }
          }
        }
      }
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