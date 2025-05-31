# Command Troubleshooting Guide

## Current Command Status

### ✅ Working Commands

#### `/status` Command
- **Status**: ✅ Fully functional
- **Purpose**: Check player status and statistics
- **Database Dependencies**: PlayerService.getPlayer()
- **Fallback Behavior**: Returns appropriate error message if player not found

#### `/use` Command  
- **Status**: ✅ Functional (with limitations)
- **Purpose**: Use items from inventory
- **Database Dependencies**: PlayerService, ItemService, InventoryService
- **Known Issues**: Item effects may not work if database unavailable
- **Fallback Behavior**: Graceful error messages for missing items/players

#### `/map` Command
- **Status**: ✅ Fixed and functional
- **Purpose**: Display current area and visual map
- **Recent Fix**: Now works with in-memory map state when database unavailable
- **Database Dependencies**: WorldMapService, ZombieService, AreaInventoryService

### 🔍 Commands Needing Verification

#### `/inventory` Command
- **Status**: 🔍 Likely working but needs testing
- **Database Dependencies**: InventoryService, PlayerService
- **Potential Issues**: May show empty inventory if database unavailable

#### `/admin` Commands
- **Status**: 🔍 Partially working
- **Working Subcommands**: reset, revealmap  
- **Database Dependencies**: Multiple services
- **Authentication**: Requires ADMIN_PASSWORD environment variable

#### `/build` Command
- **Status**: 🔍 Needs testing
- **Database Dependencies**: PlayerService, city buildings system
- **Potential Issues**: May fail if player location/action points can't be verified

#### `/move` Command
- **Status**: 🔍 Unknown
- **Database Dependencies**: PlayerService, WorldMapService
- **Potential Issues**: Coordinate updates may fail without database

#### `/take` / `/drop` Commands
- **Status**: 🔍 Unknown  
- **Database Dependencies**: InventoryService, AreaInventoryService
- **Potential Issues**: Item transfers may fail without database persistence

### ❌ Known Broken/Problematic Commands

#### Zone Contest Related Commands
- **Status**: ❌ Database query failures
- **Issue**: ZoneContestService.calculateControlPoints() fails with undefined results
- **Root Cause**: PlayerService.getPlayersByCoordinates() returns undefined instead of empty array
- **Fix Applied**: Database resilience improvements

#### Item Initialization Commands
- **Status**: ❌ Partially fixed
- **Issue**: ItemService.initializeDefaultItems() was failing 
- **Fix Applied**: Now provides fallback behavior for tests
- **Remaining Issue**: Individual item creation still fails without database

## Database Connection Issues

### Symptoms
- Error messages: "Cannot read properties of undefined (reading 'rows')"
- Connection timeout errors to PostgreSQL (port 5432)
- Redis connection failures

### Root Causes
1. **No Database Available**: Test environment doesn't have PostgreSQL/Redis running
2. **Connection Configuration**: DATABASE_URL and REDIS_URL not configured
3. **Service Dependencies**: Services expect database to always be available

### Fixes Applied

#### 1. Resilient Database Queries
Modified database query methods to handle undefined results:

```typescript
// Before (problematic)
const result = await this.db.pool.query(query, [param]);
return result.rows.map(row => this.mapRow(row));

// After (resilient) 
const result = await this.db.pool.query(query, [param]);
return result && result.rows ? result.rows.map(row => this.mapRow(row)) : [];
```

#### 2. Graceful Error Handling
```typescript
catch (error) {
  // Database not available - return fallback value
  return null; // or [] for arrays
}
```

#### 3. In-Memory Fallbacks
WorldMapService now maintains in-memory map state that works without database persistence.

## Testing Without Database

### Test Environment Behavior
When tests run without PostgreSQL/Redis:
- ✅ Map system works with in-memory state
- ✅ Services return empty/null results instead of crashing
- ✅ Commands provide appropriate error messages
- ❌ Some integration tests expect specific database content

### Running Tests
```bash
# Run all tests (some will use fallback behavior)
npm test

# Run specific test suites
npm test src/__tests__/new-map-system.test.ts
npm test src/__tests__/worldMap.test.ts
npm test src/__tests__/item-schema-integration.test.ts
```

## Production Environment Setup

### Required Services
1. **PostgreSQL Database**
   - Port: 5432 (default)
   - Database schema will be auto-initialized
   
2. **Redis Cache**
   - Port: 6379 (default)
   - Used for session data and caching

### Environment Variables
```bash
DATABASE_URL=postgresql://username:password@host:5432/database
REDIS_URL=redis://host:6379
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_app_client_id
ADMIN_PASSWORD=your_admin_password
```

### Database Schema Initialization
The DatabaseService automatically creates required tables on first connection:
- players
- items  
- inventory
- area_inventories
- bank_inventories
- explored_tiles
- zombies
- zone_contests
- cities

## Debugging Command Issues

### Step 1: Check Bot Connection
Verify the bot is properly connected to Discord and commands are registered.

### Step 2: Check Database Connection
Look for these log messages:
- "✅ Connected to PostgreSQL"
- "✅ Connected to Redis"
- "❌ Database connection failed" (indicates fallback mode)

### Step 3: Check Player State
Most commands require a player to exist. Use `/join` to create a player first.

### Step 4: Check Action Points
Many commands require action points. Use admin commands or wait for daily reset.

### Common Error Patterns

#### "Player not found"
- **Cause**: User hasn't used `/join` command
- **Solution**: Run `/join` first to create player

#### "Database connection failed"
- **Cause**: PostgreSQL/Redis not available
- **Solution**: Start database services or accept fallback behavior

#### "Invalid admin password"  
- **Cause**: ADMIN_PASSWORD environment variable not set
- **Solution**: Set environment variable and restart bot

#### "Cannot perform action"
- **Cause**: Player doesn't have sufficient action points or is in wrong state
- **Solution**: Check player status and conditions

## Development vs Production Behavior

### Development (No Database)
- Commands work with limited functionality
- Map system works in-memory only
- Player data is not persistent
- Item system provides fallback responses

### Production (With Database)
- Full functionality available
- Persistent player progress
- Map exploration is saved
- Complete item and inventory system

## Next Steps for Full Functionality

### Priority 1: Database Setup
Set up PostgreSQL and Redis in production environment for full functionality.

### Priority 2: Command Testing
Systematically test each command with database available:
1. Create test player with `/join`
2. Test basic commands: `/status`, `/inventory`, `/map`
3. Test action commands: `/use`, `/move`, `/build`
4. Test admin commands with proper password

### Priority 3: Integration Testing
Test complex workflows:
1. Player joins → explores map → finds items → uses items
2. Player builds structures → manages resources
3. Admin manages game state → resets world

### Priority 4: Performance Optimization
With database available:
1. Monitor query performance
2. Optimize frequent operations
3. Add caching for commonly accessed data
4. Monitor memory usage of in-memory systems