import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to play DIE2NITE and survive the zombie apocalypse'),
    
  async execute(interaction: CommandInteraction) {
    try {
      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle('🧟‍♂️ DIE2NITE - Survival Guide')
        .setDescription('Welcome to the zombie apocalypse! Here\'s everything you need to know to survive.')
        .addFields([
          {
            name: '🎮 Getting Started',
            value: '• Use `/join` to enter the game\n• Use `/status` to check your health and stats\n• Use `/city-info` to see your town\'s defenses',
            inline: false
          },
          {
            name: '🔍 Core Commands',
            value: '• `/explore` - Search for resources outside the city\n• `/build` - Construct defenses and facilities\n• `/return` - Go back to the safety of the city\n• `/help` - Show this help message',
            inline: false
          },
          {
            name: '⏰ Game Schedule',
            value: '🌅 **Play Mode** (9:00 PM - 7:59 PM): Take actions, explore, build\n🌙 **Horde Mode** (8:00 PM - 8:59 PM): Zombie attacks occur',
            inline: false
          },
          {
            name: '🏗️ Buildings You Can Construct',
            value: '🗼 **Watchtower** (+2 defense) - 3 AP\n🧱 **Wall** (+1 defense) - 2 AP\n🔨 **Workshop** (crafting) - 2 AP\n💧 **Well** (water source) - 2 AP\n🏥 **Hospital** (healing) - 3 AP',
            inline: false
          },
          {
            name: '🌍 Exploration Areas',
            value: '🌲 **Outside** - Nearby areas (1 AP, moderate danger)\n🌍 **Greater Outside** - Distant areas (2 AP, high danger, better rewards)',
            inline: false
          },
          {
            name: '💡 Survival Tips',
            value: '• Work together with other players to build defenses\n• Explore during the day to gather resources\n• Build watchtowers and walls before night falls\n• Keep an eye on your health and water supply\n• Return to the city before Horde Mode starts',
            inline: false
          },
          {
            name: '⚔️ Combat & Death',
            value: '• Exploring outside is dangerous - you may encounter zombies\n• If your health reaches 0, you die and cannot act until the next day\n• City defenses help protect everyone during Horde Mode\n• Dead players are revived at the start of each new day',
            inline: false
          },
          {
            name: '🤝 Community Gameplay',
            value: '• This is a cooperative survival game\n• Everyone wins or loses together\n• Share resources and coordinate building efforts\n• The goal is to survive as many days as possible',
            inline: false
          }
        ])
        .setFooter({ text: '🧟‍♂️ Good luck surviving the zombie apocalypse!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error in help command:', error);
      await interaction.reply({
        content: '❌ An error occurred while showing help.',
        ephemeral: true
      });
    }
  }
};