# DIE2NITE Discord Bot - System Architecture Documentation

## Overview

The DIE2NITE Discord Bot is a complex survival game system that adapts the classic browser-based DIE2NITE (Hordes) game for Discord. The system manages players, inventory, map exploration, zombies, and various game mechanics through Discord slash commands.

## Core Architecture

### Database Layer
- **PostgreSQL**: Primary persistent storage for game data
- **Redis**: Caching layer for active game state and temporary data

### Service Layer
The system uses a service-oriented architecture with the following key services:

#### DatabaseService (Singleton)
- **Purpose**: Manages PostgreSQL and Redis connections
- **Key Features**: 
  - Database schema initialization
  - Connection pooling
  - Graceful degradation when database is unavailable
- **Location**: `src/services/database.ts`

#### WorldMapService (Singleton)
- **Purpose**: Manages the 13x13 game world map
- **Key Features**:
  - Tile state management (hidden, explored, town, POI)
  - Map image generation
  - POI (Point of Interest) location generation
- **Resilience**: Works in-memory when database unavailable

#### ZombieService (Singleton)
- **Purpose**: Manages zombie populations across the map
- **Key Features**:
  - Location-based zombie tracking
  - Threat level calculation
  - Zombie distribution and spawning

#### PlayerService
- **Purpose**: Manages player data and state
- **Key Features**:
  - Player creation and retrieval
  - Action point management
  - Status and condition tracking
  - Location and coordinate management

#### ItemService
- **Purpose**: Manages game items and definitions
- **Key Features**:
  - Item creation from definitions
  - Item property management
  - Default item initialization

#### InventoryService
- **Purpose**: Manages player and area inventories
- **Key Features**:
  - Player inventory management
  - Encumbrance checking
  - Item transfer operations

## Command System

### Command Registration
Commands are automatically loaded from the `src/commands/` directory by the bot loader (`src/bot.ts`). Each command file exports a Discord.js SlashCommandBuilder configuration and an execute function.

### Core Commands

#### `/status` Command
**Purpose**: Display player status and statistics

**Database Interactions**:
1. Calls `PlayerService.getPlayer(discordId)` to retrieve player data
2. Queries `players` table with WHERE clause on `discord_id`
3. Returns player object with health, action points, water, location, etc.

**Example Flow**:
```
/status -> PlayerService.getPlayer() -> Database Query -> Format Discord Embed -> Reply
```

**Key Features**:
- Shows health, action points, water levels
- Displays current location and coordinates
- Shows player conditions (wounded, fed, refreshed, etc.)
- Provides warnings for critical states

#### `/use` Command
**Purpose**: Use items from player inventory

**Database Interactions**:
1. `PlayerService.getPlayer()` - Get player data
2. `ItemService.getItemByName()` - Validate item exists
3. `InventoryService.getDetailedPlayerInventory()` - Check player has item
4. `ItemEffectService.executeEffect()` - Process item effects
5. `InventoryService.removeItemFromInventory()` - Remove used item

**Key Features**:
- Item usage validation
- Effect processing (healing, killing zombies, etc.)
- Status condition checks
- Inventory management

#### `/map` Command
**Purpose**: Display current area and map

**Database Interactions**:
1. `PlayerService.getPlayer()` - Get player location
2. `WorldMapService.getLocationDisplay()` - Get area information
3. `AreaInventoryService.getAreaInventory()` - Get items on ground
4. `ZombieService.getZombiesAtLocation()` - Get zombie count
5. `WorldMapService.generateMapView()` - Create map image

#### `/inventory` Command
**Purpose**: View player or other player's inventory

**Database Interactions**:
1. `PlayerService.getPlayer()` - Get target player
2. `InventoryService.getDetailedPlayerInventory()` - Get inventory items
3. `InventoryService.getInventoryCount()` - Get item count
4. `InventoryService.isPlayerEncumbered()` - Check encumbrance

#### `/admin` Commands
**Purpose**: Administrative functions for testing and management

**Key Functions**:
- `reset`: Complete world reset
- `revive`: Revive dead players
- `spawn`: Spawn items for players
- `revealmap`: Reveal entire map
- `fillbank`: Fill town bank with items

## Data Models

### Player Entity
```sql
CREATE TABLE players (
  id UUID PRIMARY KEY,
  discord_id BIGINT UNIQUE,
  name VARCHAR(255),
  health INTEGER,
  max_health INTEGER,
  action_points INTEGER,
  max_action_points INTEGER,
  water INTEGER,
  is_alive BOOLEAN,
  status VARCHAR(50),
  conditions JSONB,
  location VARCHAR(50),
  x INTEGER,
  y INTEGER,
  last_action_time TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Items Entity
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50),
  description TEXT,
  weight INTEGER,
  category VARCHAR(100),
  sub_category VARCHAR(100),
  kill_chance DECIMAL,
  break_chance DECIMAL,
  kill_count INTEGER,
  on_break VARCHAR(255),
  broken BOOLEAN,
  created_at TIMESTAMP
);
```

### Map State Tables
```sql
CREATE TABLE explored_tiles (
  x INTEGER,
  y INTEGER,
  created_at TIMESTAMP,
  PRIMARY KEY (x, y)
);

CREATE TABLE zombies (
  x INTEGER,
  y INTEGER,
  count INTEGER,
  updated_at TIMESTAMP,
  PRIMARY KEY (x, y)
);
```

## Error Handling and Resilience

### Database Connection Failures
The system is designed to handle database unavailability gracefully:

1. **WorldMapService**: Falls back to in-memory tile state management
2. **ZombieService**: Returns null/empty results instead of throwing errors
3. **PlayerService**: Returns null/empty arrays for queries
4. **ItemService**: Provides fallback responses for tests

### Example Error Handling Pattern
```typescript
async getPlayer(discordId: string): Promise<Player | null> {
  try {
    const result = await this.db.pool.query(query, [discordId]);
    if (result && result.rows && result.rows.length > 0) {
      return this.mapRowToPlayer(result.rows[0]);
    }
    return null;
  } catch (error) {
    // Database not available - return null
    return null;
  }
}
```

## Game Flow Example

### Player Status Check Flow
1. User types `/status` in Discord
2. Discord sends interaction to bot
3. Bot routes to status command handler
4. Command calls `PlayerService.getPlayer(discordId)`
5. PlayerService queries database for player data
6. If found, data is formatted into Discord embed
7. Embed includes:
   - Health/max health
   - Action points/max action points
   - Water level
   - Current location
   - Active conditions
   - Warnings for critical states
8. Response sent back to Discord user

### Item Usage Flow
1. User types `/use sword` 
2. Bot validates player exists and has item
3. System checks item effects and usage restrictions
4. Effects are executed (e.g., zombie killing)
5. Item is removed from inventory
6. Results are formatted and sent to user
7. Game state is updated in database

## Configuration and Environment

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string  
- `DISCORD_TOKEN`: Discord bot token
- `DISCORD_CLIENT_ID`: Discord application client ID
- `ADMIN_PASSWORD`: Password for admin commands

### Key Configuration
- Map size: 13x13 grid
- Center coordinates: (6,6) as town/gate
- Maximum inventory: Configurable per player
- Action point regeneration: Daily reset

## Testing Strategy

### Database-Independent Tests
Tests are designed to work without database connections by:
- Services returning fallback values when database unavailable
- In-memory state management for critical components
- Graceful error handling that doesn't break test execution

### Test Categories
1. **Unit Tests**: Individual service methods
2. **Integration Tests**: Command execution flows
3. **Map System Tests**: Tile state and rendering
4. **Item System Tests**: Creation and usage flows

## Performance Considerations

### Singleton Pattern Usage
Critical services use singleton pattern to:
- Maintain consistent state across the application
- Reduce database connection overhead
- Cache frequently accessed data

### Caching Strategy
- Redis for active player sessions
- In-memory caching for map state
- Database connection pooling for PostgreSQL

## Security

### Admin Command Protection
- Password-based authentication for admin commands
- Ephemeral responses to hide sensitive information
- User permission validation

### Input Validation
- Discord ID validation
- Item name sanitization
- Coordinate bounds checking
- SQL injection prevention through parameterized queries

## Monitoring and Logging

### Logging Strategy
- Database connection status
- Command execution results
- Error conditions and fallbacks
- Performance metrics for critical operations

### Health Checks
- Database connectivity monitoring
- Service availability checks
- Error rate tracking