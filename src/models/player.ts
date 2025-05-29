import { Player, Location, GamePhase } from '../types/game';
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

  async updatePlayerLocation(discordId: string, location: Location): Promise<boolean> {
    try {
      const query = `
        UPDATE players 
        SET location = $1, updated_at = NOW()
        WHERE discord_id = $2
      `;
      const result = await this.db.pool.query(query, [location, discordId]);
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
      const query = `
        UPDATE players 
        SET health = max_health,
            action_points = max_action_points,
            water = 10,
            is_alive = true,
            location = 'city',
            updated_at = NOW()
      `;
      await this.db.pool.query(query);
      console.log('✅ All players reset to default state');
      return true;
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
            location = 'city',
            updated_at = NOW()
        WHERE discord_id = $1
      `;
      const result = await this.db.pool.query(query, [discordId]);
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

  private mapRowToPlayer(row: any): Player {
    return {
      id: row.id,
      discordId: row.discord_id,
      name: row.name,
      health: row.health,
      maxHealth: row.max_health,
      actionPoints: row.action_points,
      maxActionPoints: row.max_action_points,
      water: row.water,
      isAlive: row.is_alive,
      location: row.location as Location,
      inventory: [], // Will be loaded separately
      lastActionTime: row.last_action_time
    };
  }
}