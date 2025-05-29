// Test setup
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock Discord.js client for tests
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    once: jest.fn(),
    on: jest.fn(),
    login: jest.fn(),
    destroy: jest.fn(),
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
  },
  Collection: Map,
  REST: jest.fn(),
  Routes: {
    applicationCommands: jest.fn(),
  },
  SlashCommandBuilder: jest.fn(),
  EmbedBuilder: jest.fn(),
}));

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';