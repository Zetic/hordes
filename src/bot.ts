import { Client, GatewayIntentBits, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GameEngine } from './services/gameEngine';

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