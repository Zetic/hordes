import { Player, Location, GamePhase, PlayerStatus, PlayerCondition } from '../types/game';
import { DatabaseService } from '../services/database';

export class PlayerService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async createPlayer(discordId: string, name: string): Promise<Player | null> {
    try {
      const query = `
        INSERT INTO players (discord_id, name)
        VALUES ($1, $2)
        RETURNING *
      `;
      const result = await this.db.pool.query(query, [discordId, name]);
      
      if (result.rows.length > 0) {
        return this.mapRowToPlayer(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error creating player:', error);
      return null;
    }
  }

  async getPlayer(discordId: string): Promise<Player | null> {
    try {
      const query = 'SELECT * FROM players WHERE discord_id = $1';
      const result = await this.db.pool.query(query, [discordId]);
      
      if (result.rows.length > 0) {
        return this.mapRowToPlayer(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error getting player:', error);
      return null;
    }
  }

  async updatePlayerHealth(discordId: string, health: number): Promise<boolean> {
    try {
      const isAlive = health > 0;
      const query = `
        UPDATE players 
        SET health = $1, is_alive = $2, updated_at = NOW()
        WHERE discord_id = $3
      `;
      const result = await this.db.pool.query(query, [health, isAlive, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating player health:', error);
      return false;
    }
  }

  async updatePlayerStatus(discordId: string, status: PlayerStatus): Promise<boolean> {
    try {
      const isAlive = status !== PlayerStatus.DEAD;
      const query = `
        UPDATE players 
        SET status = $1, is_alive = $2, updated_at = NOW()
        WHERE discord_id = $3
      `;
      const result = await this.db.pool.query(query, [status, isAlive, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating player status:', error);
      return false;
    }
  }

  async addPlayerCondition(discordId: string, condition: string): Promise<boolean> {
    try {
      // Map condition string to column name
      const columnName = this.getConditionColumnName(condition);
      if (!columnName) {
        console.error(`Invalid condition: ${condition}`);
        return false;
      }

      // Update the specific condition column to true
      const query = `
        UPDATE players 
        SET ${columnName} = true, updated_at = NOW()
        WHERE discord_id = $1
      `;
      const result = await this.db.pool.query(query, [discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error adding player condition:', error);
      return false;
    }
  }

  async removePlayerCondition(discordId: string, condition: string): Promise<boolean> {
    try {
      // Map condition string to column name
      const columnName = this.getConditionColumnName(condition);
      if (!columnName) {
        console.error(`Invalid condition: ${condition}`);
        return false;
      }

      // Update the specific condition column to false
      const query = `
        UPDATE players 
        SET ${columnName} = false, updated_at = NOW()
        WHERE discord_id = $1
      `;
      const result = await this.db.pool.query(query, [discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error removing player condition:', error);
      return false;
    }
  }

  async updatePlayerActionPoints(discordId: string, actionPoints: number): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET action_points = GREATEST(0, LEAST($1, max_action_points)),
            last_action_time = NOW(),
            updated_at = NOW()
        WHERE discord_id = $2
      `;
      const result = await this.db.pool.query(query, [actionPoints, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating player action points:', error);
      return false;
    }
  }

  async updatePlayerLocation(discordId: string, location: Location, x?: number, y?: number): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET location = $1, x = $2, y = $3, updated_at = NOW()
        WHERE discord_id = $4
      `;
      const result = await this.db.pool.query(query, [location, x !== undefined ? x : null, y !== undefined ? y : null, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating player location:', error);
      return false;
    }
  }

  async spendActionPoints(discordId: string, points: number): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET action_points = GREATEST(0, action_points - $1), 
            last_action_time = NOW(),
            updated_at = NOW()
        WHERE discord_id = $2 AND action_points >= $1
      `;
      const result = await this.db.pool.query(query, [points, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error spending action points:', error);
      return false;
    }
  }

  async resetDailyActionPoints(): Promise<void> {
    try {
      // Only reset action points for alive players - dead players stay dead until town reset
      const query = `
        UPDATE players 
        SET action_points = max_action_points,
            updated_at = NOW()
        WHERE is_alive = true
      `;
      await this.db.pool.query(query);
      console.log('✅ Daily action points reset for alive players (dead players remain dead)');
    } catch (error) {
      console.error('Error resetting action points:', error);
    }
  }

  async getAlivePlayers(): Promise<Player[]> {
    try {
      const query = 'SELECT * FROM players WHERE is_alive = true';
      const result = await this.db.pool.query(query);
      return result.rows.map(row => this.mapRowToPlayer(row));
    } catch (error) {
      console.error('Error getting alive players:', error);
      return [];
    }
  }

  async resetAllPlayers(): Promise<boolean> {
    try {
      const client = await this.db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Clear all player inventories
        await client.query('DELETE FROM inventory');
        console.log('✅ Cleared all player inventories');
        
        // Reset all players to default state with cleared coordinates
        const resetQuery = `
          UPDATE players 
          SET health = max_health,
              action_points = max_action_points,
              water = 10,
              is_alive = true,
              status = $1,
              condition_healthy = true,
              condition_wounded = false,
              condition_fed = false,
              condition_refreshed = false,
              condition_thirsty = false,
              condition_dehydrated = false,
              condition_exhausted = false,
              location = $2,
              x = NULL,
              y = NULL,
              updated_at = NOW()
          WHERE id IS NOT NULL
        `;
        await client.query(resetQuery, [PlayerStatus.ALIVE, Location.CITY]);
        
        await client.query('COMMIT');
        console.log('✅ All players reset to default state with cleared inventories and coordinates');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error resetting all players:', error);
      return false;
    }
  }

  async resetPlayerActionPoints(discordId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET action_points = max_action_points,
            updated_at = NOW()
        WHERE discord_id = $1
      `;
      const result = await this.db.pool.query(query, [discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error resetting player action points:', error);
      return false;
    }
  }

  async revivePlayer(discordId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET health = max_health,
            is_alive = true,
            status = $1,
            condition_healthy = true,
            condition_wounded = false,
            condition_fed = false,
            condition_refreshed = false,
            condition_thirsty = false,
            condition_dehydrated = false,
            condition_exhausted = false,
            location = $2,
            updated_at = NOW()
        WHERE discord_id = $3
      `;
      const result = await this.db.pool.query(query, [PlayerStatus.ALIVE, Location.CITY, discordId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error reviving player:', error);
      return false;
    }
  }

  async getPlayersByLocation(location: Location): Promise<Player[]> {
    try {
      const query = 'SELECT * FROM players WHERE location = $1 AND is_alive = true';
      const result = await this.db.pool.query(query, [location]);
      return result.rows.map(row => this.mapRowToPlayer(row));
    } catch (error) {
      console.error('Error getting players by location:', error);
      return [];
    }
  }

  async getPlayersByCoordinates(x: number, y: number): Promise<Player[]> {
    try {
      const query = 'SELECT * FROM players WHERE x = $1 AND y = $2 AND is_alive = true';
      const result = await this.db.pool.query(query, [x, y]);
      return result.rows.map(row => this.mapRowToPlayer(row));
    } catch (error) {
      console.error('Error getting players by coordinates:', error);
      return [];
    }
  }

  private mapRowToPlayer(row: any): Player {
    // Map individual boolean condition columns to PlayerCondition array
    let conditions: PlayerCondition[] = [];
    
    // Check each condition boolean column and add to array if true
    if (row.condition_healthy) conditions.push(PlayerCondition.HEALTHY);
    if (row.condition_wounded) conditions.push(PlayerCondition.WOUNDED);
    if (row.condition_fed) conditions.push(PlayerCondition.FED);
    if (row.condition_refreshed) conditions.push(PlayerCondition.REFRESHED);
    if (row.condition_thirsty) conditions.push(PlayerCondition.THIRSTY);
    if (row.condition_dehydrated) conditions.push(PlayerCondition.DEHYDRATED);
    if (row.condition_exhausted) conditions.push(PlayerCondition.EXHAUSTED);

    return {
      id: row.id,
      discordId: row.discord_id,
      name: row.name,
      health: row.health,
      maxHealth: row.max_health,
      status: row.status as PlayerStatus,
      conditions: conditions,
      actionPoints: row.action_points,
      maxActionPoints: row.max_action_points,
      water: row.water,
      isAlive: row.is_alive,
      location: row.location as Location,
      x: row.x,
      y: row.y,
      inventory: [], // Will be loaded separately
      lastActionTime: row.last_action_time
    };
  }

  private getConditionColumnName(condition: string): string | null {
    // Map PlayerCondition enum values to database column names
    const conditionMap: { [key: string]: string } = {
      [PlayerCondition.HEALTHY]: 'condition_healthy',
      [PlayerCondition.WOUNDED]: 'condition_wounded',
      [PlayerCondition.FED]: 'condition_fed',
      [PlayerCondition.REFRESHED]: 'condition_refreshed',
      [PlayerCondition.THIRSTY]: 'condition_thirsty',
      [PlayerCondition.DEHYDRATED]: 'condition_dehydrated',
      [PlayerCondition.EXHAUSTED]: 'condition_exhausted'
    };
    
    return conditionMap[condition] || null;
  }
}