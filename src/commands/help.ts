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
            value: '• Use `/join` to enter the game\n• Use `/status` to check your condition and stats\n• Use `/town` to see your town\'s defenses',
            inline: false
          },
          {
            name: '🔍 Core Commands',
            value: '• `/depart` - Leave the city through the gate\n• `/move <direction>` - Navigate the world map\n• `/return` - Return to the city from the gate\n• `/gate` - Control or check the city gate status\n• `/build` - Construct defenses and facilities\n• `/help` - Show this help message',
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
            name: '🗺️ Grid-Based World',
            value: '<z_gate> **Gate** - Center tile, entrance to town\n<z_evergreen_tree> **Waste** - Inner exploration areas (moderate danger)\n🌍 **Greater Waste** - Border areas (high danger, better rewards)\n\n**Directions**: North, Northeast, East, Southeast, South, Southwest, West, Northwest',
            inline: false
          },
          {
            name: '💡 Survival Tips',
            value: '• Work together with other players to build defenses\n• Use `/gate open` to allow exploration outside the city\n• Navigate step by step using `/move <direction>`\n• Build watchtowers and walls before night falls\n• Monitor your status and water supply\n• Return to the gate before Horde Mode starts',
            inline: false
          },
          {
            name: '⚔️ Combat & Death',
            value: '• Moving through the wasteland is dangerous - you may encounter zombies\n• Getting hurt while wounded will kill you\n• City defenses help protect everyone during Horde Mode\n• Dead players are revived at the start of each new day\n• The gate must be open to enter or leave the city',
            inline: false
          },
          {
            name: '🤝 Community Gameplay',
            value: '• This is a cooperative survival game\n• Everyone wins or loses together\n• Share resources and coordinate building efforts\n• The goal is to survive as many days as possible',
            inline: false
          },
          {
            name: '⚙️ Admin Commands',
            value: '• `/admin reset password` - Resets the town (testing)\n• `/admin horde password` - Triggers horde attack results (testing)\n• `/admin refresh user password` - Refreshes player action points (testing)',
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