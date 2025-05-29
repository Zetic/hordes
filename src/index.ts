import Die2NiteBot from './bot';

const bot = new Die2NiteBot();

async function main() {
  console.log('🧟‍♂️ Starting DIE2NITE Discord Bot...');
  
  try {
    await bot.start();
    console.log('🎮 Bot is running and ready for zombie apocalypse!');
  } catch (error) {
    console.error('💀 Failed to start the bot:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot...');
  bot.client.destroy();
  process.exit(0);
});

main();