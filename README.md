# DIE2NITE Discord Bot

A Discord bot adaptation of the classic browser survival game DIE2NITE (Hordes), bringing the zombie apocalypse survival experience to Discord servers through slash commands and community gameplay.

## Project Status

🚧 **Planning Phase** - Currently developing the comprehensive project plan and technical specifications.

## Documentation

- **[📋 Project Plan](./DIE2NITE_DISCORD_BOT_PROJECT_PLAN.md)** - Detailed analysis, design, and implementation roadmap
- **[📊 Feature Status](./FEATURE_STATUS.md)** - Current implementation status, working features, and development priorities
- **[🎮 Original Game](https://github.com/motion-twin/WebGamesArchives/tree/main/Hordes)** - Reference source code for the original DIE2NITE game

## About DIE2NITE

DIE2NITE was a popular browser-based survival game where players worked together to defend their town against nightly zombie attacks. Players had to manage resources, build defenses, explore dangerous areas for supplies, and coordinate with their community to survive as long as possible.

## Discord Adaptation Goals

- **🤝 Community Survival**: Preserve the cooperative gameplay that made the original special
- **⚡ Slash Commands**: Intuitive command interface for all game actions
- **🗺️ Text-Based World**: ASCII/emoji representations of the game world
- **🔄 Turn-Based Mechanics**: Adapted for Discord's asynchronous nature
- **🏰 City Building**: Collaborative construction and defense systems
- **📊 Rich Status Displays**: Discord embeds showing game state and player info

# DIE2NITE Discord Bot

A Discord bot adaptation of the classic browser survival game DIE2NITE (Hordes), bringing the zombie apocalypse survival experience to Discord servers through slash commands and community gameplay.

## Project Status

🎮 **IMPLEMENTED** - The core game is now functional! Players can join, explore, build, and survive together against nightly zombie attacks.

## Features

### ✅ Implemented
- **Player Management**: Join game, track health/action points/water
- **Exploration System**: Search for resources in dangerous areas
- **Building System**: Construct defensive buildings and facilities
- **City Management**: Shared town with defenses and population tracking
- **Day/Night Cycle**: Automated game phases with zombie attacks
- **Real-time Scheduling**: 21:00-19:59 Play Mode, 20:00-20:59 Horde Mode
- **Rich Discord Integration**: Beautiful embeds and slash commands

### 🎯 Core Commands
- `/join` - Join the survival game
- `/status` - Check your stats and health
- `/city-info` - View city defenses and population
- `/explore` - Search for resources outside the city
- `/build` - Construct buildings to defend the city
- `/return` - Go back to the safety of the city
- `/help` - Complete gameplay guide

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Redis server
- Discord Bot Token

### Installation

1. **Clone and install dependencies:**
```bash
git clone https://github.com/Zetic/hordes.git
cd hordes
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up the database:**
```bash
# Create PostgreSQL database and run:
psql -d your_database < database/schema.sql
```

4. **Build and start:**
```bash
npm run build
npm start
```

### Environment Configuration

Edit `.env` with your settings:
```env
NODE_ENV=production
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
DATABASE_URL=postgresql://user:pass@localhost:5432/die2nite
REDIS_URL=redis://localhost:6379
```

## Documentation

- **[📋 Project Plan](./DIE2NITE_DISCORD_BOT_PROJECT_PLAN.md)** - Detailed analysis, design, and implementation roadmap
- **[📊 Feature Status](./FEATURE_STATUS.md)** - Current implementation status, working features, and development priorities
- **[🎮 Original Game](https://github.com/motion-twin/WebGamesArchives/tree/main/Hordes)** - Reference source code for the original DIE2NITE game

## About DIE2NITE

DIE2NITE was a popular browser-based survival game where players worked together to defend their town against nightly zombie attacks. Players had to manage resources, build defenses, explore dangerous areas for supplies, and coordinate with their community to survive as long as possible.

## Discord Adaptation Goals

- **🤝 Community Survival**: Preserve the cooperative gameplay that made the original special
- **⚡ Slash Commands**: Intuitive command interface for all game actions
- **🗺️ Text-Based World**: ASCII/emoji representations of the game world
- **🔄 Turn-Based Mechanics**: Adapted for Discord's asynchronous nature
- **🏰 City Building**: Collaborative construction and defense systems
- **📊 Rich Status Displays**: Discord embeds showing game state and player info

## Game Mechanics

### Daily Cycle
- **Play Mode** (9:00 PM - 7:59 PM): Players can take actions, explore, and build
- **Horde Mode** (8:00 PM - 8:59 PM): Zombie attacks occur automatically

### Core Gameplay
- **Exploration**: Search outside areas for resources (with risk of zombie encounters)
- **Building**: Construct defenses like watchtowers and walls
- **Resource Management**: Manage health, action points, and water supplies
- **Community Cooperation**: Work together to survive as long as possible

### Buildings
- 🗼 **Watchtower** (+2 defense) - Early warning system
- 🧱 **Wall** (+1 defense) - Physical barrier  
- 🔨 **Workshop** - Advanced crafting capabilities
- 💧 **Well** - Water source for the community
- 🏥 **Hospital** - Medical facilities for healing

## Development

### Scripts
```bash
npm run build    # Compile TypeScript
npm run dev      # Development mode with ts-node
npm start        # Production mode
npm run lint     # Run ESLint
npm test         # Run tests
```

### Architecture
- **TypeScript** for type safety
- **Discord.js v14** for Discord integration
- **PostgreSQL** for persistent data
- **Redis** for caching and sessions
- **Node-cron** for automated game events

## Contributing

This project implements the game mechanics described in the comprehensive project plan. The codebase is structured for easy extension with additional features like:

- Advanced crafting system
- More building types
- Trading between players
- Special events and encounters
- Enhanced combat mechanics

## License

MIT License - Feel free to use and modify for your own Discord servers!
