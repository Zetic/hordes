import { City, GamePhase, Building, BuildingType } from '../types/game';
import { DatabaseService } from '../services/database';

export class CityService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async createCity(name: string): Promise<City | null> {
    try {
      const query = `
        INSERT INTO cities (name)
        VALUES ($1)
        RETURNING *
      `;
      const result = await this.db.pool.query(query, [name]);
      
      if (result.rows.length > 0) {
        return this.mapRowToCity(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error creating city:', error);
      return null;
    }
  }

  async getCity(cityId: string): Promise<City | null> {
    try {
      const query = 'SELECT * FROM cities WHERE id = $1';
      const result = await this.db.pool.query(query, [cityId]);
      
      if (result.rows.length > 0) {
        const city = this.mapRowToCity(result.rows[0]);
        city.buildings = await this.getCityBuildings(cityId);
        return city;
      }
      return null;
    } catch (error) {
      console.error('Error getting city:', error);
      return null;
    }
  }

  async getDefaultCity(): Promise<City | null> {
    try {
      // Get the first city or create one if none exists
      const query = 'SELECT * FROM cities ORDER BY created_at LIMIT 1';
      const result = await this.db.pool.query(query);
      
      if (result.rows.length > 0) {
        const city = this.mapRowToCity(result.rows[0]);
        city.buildings = await this.getCityBuildings(city.id);
        return city;
      } else {
        // Create default city
        return await this.createCity('Sanctuary');
      }
    } catch (error) {
      console.error('Error getting default city:', error);
      return null;
    }
  }

  async updateGamePhase(cityId: string, phase: GamePhase): Promise<boolean> {
    try {
      const query = `
        UPDATE cities 
        SET game_phase = $1, updated_at = NOW()
        WHERE id = $2
      `;
      const result = await this.db.pool.query(query, [phase, cityId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating game phase:', error);
      return false;
    }
  }

  async advanceDay(cityId: string): Promise<boolean> {
    try {
      const query = `
        UPDATE cities 
        SET day = day + 1, updated_at = NOW()
        WHERE id = $1
      `;
      const result = await this.db.pool.query(query, [cityId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error advancing day:', error);
      return false;
    }
  }

  async addBuilding(cityId: string, type: BuildingType): Promise<Building | null> {
    try {
      const query = `
        INSERT INTO buildings (city_id, type)
        VALUES ($1, $2)
        RETURNING *
      `;
      const result = await this.db.pool.query(query, [cityId, type]);
      
      if (result.rows.length > 0) {
        return this.mapRowToBuilding(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error adding building:', error);
      return null;
    }
  }

  async getCityBuildings(cityId: string): Promise<Building[]> {
    try {
      const query = 'SELECT * FROM buildings WHERE city_id = $1';
      const result = await this.db.pool.query(query, [cityId]);
      return result.rows.map(row => this.mapRowToBuilding(row));
    } catch (error) {
      console.error('Error getting city buildings:', error);
      return [];
    }
  }

  async updateCityPopulation(cityId: string): Promise<void> {
    try {
      const query = `
        UPDATE cities 
        SET population = (
          SELECT COUNT(*) FROM players WHERE is_alive = true
        ),
        updated_at = NOW()
        WHERE id = $1
      `;
      await this.db.pool.query(query, [cityId]);
    } catch (error) {
      console.error('Error updating city population:', error);
    }
  }

  async resetCity(cityId: string): Promise<boolean> {
    try {
      // Reset city to day 1, play mode, no defense
      const updateCityQuery = `
        UPDATE cities 
        SET day = 1,
            game_phase = 'play_mode',
            defense_level = 0,
            population = (SELECT COUNT(*) FROM players WHERE is_alive = true),
            updated_at = NOW()
        WHERE id = $1
      `;
      await this.db.pool.query(updateCityQuery, [cityId]);

      // Delete all buildings
      const deleteBuildingsQuery = 'DELETE FROM buildings WHERE city_id = $1';
      await this.db.pool.query(deleteBuildingsQuery, [cityId]);

      // Clear all bank inventories
      const clearBankQuery = 'DELETE FROM bank_inventories WHERE city_id = $1';
      await this.db.pool.query(clearBankQuery, [cityId]);

      console.log('✅ City reset to initial state (buildings and bank cleared)');
      return true;
    } catch (error) {
      console.error('Error resetting city:', error);
      return false;
    }
  }

  async updateGateStatus(cityId: string, gateOpen: boolean): Promise<boolean> {
    try {
      const query = `
        UPDATE cities 
        SET gate_open = $1, updated_at = NOW() 
        WHERE id = $2
      `;
      const result = await this.db.pool.query(query, [gateOpen, cityId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating gate status:', error);
      return false;
    }
  }

  private mapRowToCity(row: any): City {
    return {
      id: row.id,
      name: row.name,
      defenseLevel: row.defense_level,
      buildings: [], // Will be loaded separately
      resources: [], // Will be loaded separately
      population: row.population,
      day: row.day,
      gamePhase: row.game_phase as GamePhase,
      gateOpen: row.gate_open !== false // Default to true if not set
    };
  }

  private mapRowToBuilding(row: any): Building {
    return {
      id: row.id,
      type: row.type as BuildingType,
      level: row.level,
      health: row.health,
      maxHealth: row.max_health
    };
  }
}