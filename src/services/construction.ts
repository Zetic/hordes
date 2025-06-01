import { DatabaseService } from './database';
import { ConstructionProject, ProjectMaterialRequirement, WellWater, DailyWaterRation } from '../types/game';
import { BankService } from '../models/bank';

export class ConstructionService {
  private db: DatabaseService;
  private bankService: BankService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.bankService = new BankService();
  }

  // Get all available construction projects for a city
  async getAvailableProjects(cityId: string): Promise<ConstructionProject[]> {
    try {
      const query = `
        SELECT cp.*, 
               cpm.id as mat_id, cpm.item_name, cpm.required_quantity
        FROM construction_projects cp
        LEFT JOIN construction_project_materials cpm ON cp.id = cpm.project_id
        WHERE cp.city_id = $1 AND cp.is_completed = false
        ORDER BY cp.project_name, cpm.item_name
      `;
      const result = await this.db.pool.query(query, [cityId]);
      return this.mapRowsToProjects(result.rows);
    } catch (error) {
      console.error('Error getting available projects:', error);
      return [];
    }
  }

  // Get a specific construction project by ID
  async getProject(projectId: string): Promise<ConstructionProject | null> {
    try {
      const query = `
        SELECT cp.*, 
               cpm.id as mat_id, cpm.item_name, cpm.required_quantity
        FROM construction_projects cp
        LEFT JOIN construction_project_materials cpm ON cp.id = cpm.project_id
        WHERE cp.id = $1
        ORDER BY cpm.item_name
      `;
      const result = await this.db.pool.query(query, [projectId]);
      if (result.rows.length === 0) return null;
      
      const projects = this.mapRowsToProjects(result.rows);
      return projects[0] || null;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  // Add AP to a construction project
  async addApToProject(projectId: string, apAmount: number = 1): Promise<boolean> {
    try {
      const query = `
        UPDATE construction_projects 
        SET current_ap_progress = current_ap_progress + $1,
            updated_at = NOW()
        WHERE id = $2 AND is_completed = false
        RETURNING current_ap_progress, total_ap_required
      `;
      const result = await this.db.pool.query(query, [apAmount, projectId]);
      
      if (result.rows.length === 0) return false;
      
      const { current_ap_progress, total_ap_required } = result.rows[0];
      
      // Check if project is now complete
      if (current_ap_progress >= total_ap_required) {
        await this.completeProject(projectId);
      }
      
      return true;
    } catch (error) {
      console.error('Error adding AP to project:', error);
      return false;
    }
  }

  // Complete a construction project and convert it to a building
  async completeProject(projectId: string): Promise<boolean> {
    try {
      const client = await this.db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Get project details
        const projectQuery = 'SELECT * FROM construction_projects WHERE id = $1';
        const projectResult = await client.query(projectQuery, [projectId]);
        
        if (projectResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }
        
        const project = projectResult.rows[0];
        
        // Mark project as completed
        const completeQuery = `
          UPDATE construction_projects 
          SET is_completed = true, completed_at = NOW()
          WHERE id = $1
        `;
        await client.query(completeQuery, [projectId]);
        
        // Create corresponding building
        const buildingQuery = `
          INSERT INTO buildings (city_id, type, category, sub_category, is_visitable, defense_bonus)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(buildingQuery, [
          project.city_id,
          project.project_type,
          project.category,
          project.sub_category,
          project.is_visitable,
          project.defense_bonus
        ]);
        
        await client.query('COMMIT');
        console.log(`✅ Construction project ${project.project_name} completed and building created`);
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error completing project:', error);
      return false;
    }
  }

  // Check if all material requirements are met
  async checkMaterialRequirements(projectId: string, cityId: string): Promise<{available: boolean, details: Array<{itemName: string, required: number, available: number}>}> {
    try {
      const project = await this.getProject(projectId);
      if (!project) return { available: false, details: [] };
      
      const bankInventory = await this.bankService.getBankInventory(cityId);
      const details = [];
      let allAvailable = true;
      
      for (const requirement of project.materialRequirements) {
        const bankItem = bankInventory.find(item => item.item.name === requirement.itemName);
        const availableQuantity = bankItem ? bankItem.quantity : 0;
        
        details.push({
          itemName: requirement.itemName,
          required: requirement.requiredQuantity,
          available: availableQuantity
        });
        
        if (availableQuantity < requirement.requiredQuantity) {
          allAvailable = false;
        }
      }
      
      return { available: allAvailable, details };
    } catch (error) {
      console.error('Error checking material requirements:', error);
      return { available: false, details: [] };
    }
  }

  // Initialize default projects for a city
  async initializeDefaultProjects(cityId: string): Promise<void> {
    try {
      // Check if projects already exist
      const existingProjects = await this.getAvailableProjects(cityId);
      if (existingProjects.length > 0) return;
      
      const client = await this.db.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Define the default projects based on the requirements
        const projects = [
          {
            projectType: 'defensive_wall',
            projectName: 'Defensive Wall',
            description: 'A strong defensive wall that provides 30 defense to the town',
            category: 'Buildings',
            subCategory: 'Wall',
            totalApRequired: 25,
            isVisitable: false,
            defenseBonus: 30,
            materials: [
              { itemName: 'Twisted Plank', requiredQuantity: 8 },
              { itemName: 'Wrought Metal', requiredQuantity: 4 }
            ]
          },
          {
            projectType: 'pump',
            projectName: 'Pump',
            description: 'Adds 15 water to the well and allows players to take 2 water rations per day',
            category: 'Buildings',
            subCategory: 'Plumbing',
            totalApRequired: 25,
            isVisitable: false,
            defenseBonus: 0,
            materials: [
              { itemName: 'Wrought Metal', requiredQuantity: 8 },
              { itemName: 'Copper Pipe', requiredQuantity: 1 }
            ]
          },
          {
            projectType: 'workshop',
            projectName: 'Workshop',
            description: 'Allows converting resources at 3 AP cost and combining items into new items',
            category: 'Buildings',
            subCategory: 'Industry',
            totalApRequired: 25,
            isVisitable: true,
            defenseBonus: 0,
            materials: [
              { itemName: 'Twisted Plank', requiredQuantity: 10 },
              { itemName: 'Wrought Metal', requiredQuantity: 8 }
            ]
          },
          {
            projectType: 'watch_tower',
            projectName: 'Watch Tower',
            description: 'Provides 10 defense and allows estimating horde size',
            category: 'Buildings',
            subCategory: 'Tower',
            totalApRequired: 15,
            isVisitable: true,
            defenseBonus: 10,
            materials: [
              { itemName: 'Twisted Plank', requiredQuantity: 3 },
              { itemName: 'Patchwork Beam', requiredQuantity: 1 },
              { itemName: 'Wrought Metal', requiredQuantity: 1 }
            ]
          },
          {
            projectType: 'portal_lock',
            projectName: 'Portal Lock',
            description: 'Prevents gate from being opened within 15 minutes of horde phase',
            category: 'Buildings',
            subCategory: 'Gate',
            totalApRequired: 15,
            isVisitable: false,
            defenseBonus: 0,
            materials: [
              { itemName: 'Wrought Metal', requiredQuantity: 2 }
            ]
          }
        ];
        
        for (const project of projects) {
          // Insert project
          const projectQuery = `
            INSERT INTO construction_projects 
            (city_id, project_type, project_name, description, category, sub_category, 
             total_ap_required, is_visitable, defense_bonus)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `;
          const projectResult = await client.query(projectQuery, [
            cityId, project.projectType, project.projectName, project.description,
            project.category, project.subCategory, project.totalApRequired,
            project.isVisitable, project.defenseBonus
          ]);
          
          const projectId = projectResult.rows[0].id;
          
          // Insert material requirements
          for (const material of project.materials) {
            const materialQuery = `
              INSERT INTO construction_project_materials (project_id, item_name, required_quantity)
              VALUES ($1, $2, $3)
            `;
            await client.query(materialQuery, [projectId, material.itemName, material.requiredQuantity]);
          }
        }
        
        await client.query('COMMIT');
        console.log(`✅ Initialized default construction projects for city ${cityId}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error initializing default projects:', error);
    }
  }

  // Well Water Management
  async initializeWell(cityId: string): Promise<void> {
    try {
      // Check if well already exists
      const existingQuery = 'SELECT id FROM well_water WHERE city_id = $1';
      const existingResult = await this.db.pool.query(existingQuery, [cityId]);
      
      if (existingResult.rows.length > 0) return;
      
      // Create well with random starting water between 90-180
      const startingWater = Math.floor(Math.random() * (180 - 90 + 1)) + 90;
      const query = `
        INSERT INTO well_water (city_id, current_water, max_water)
        VALUES ($1, $2, 180)
      `;
      await this.db.pool.query(query, [cityId, startingWater]);
      console.log(`✅ Initialized well for city ${cityId} with ${startingWater} water`);
    } catch (error) {
      console.error('Error initializing well:', error);
    }
  }

  async getWellWater(cityId: string): Promise<WellWater | null> {
    try {
      const query = 'SELECT * FROM well_water WHERE city_id = $1';
      const result = await this.db.pool.query(query, [cityId]);
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
        cityId: row.city_id,
        currentWater: row.current_water,
        maxWater: row.max_water
      };
    } catch (error) {
      console.error('Error getting well water:', error);
      return null;
    }
  }

  async takeWaterRation(playerId: string, cityId: string): Promise<{success: boolean, message: string, rationsTaken: number}> {
    try {
      const client = await this.db.pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Check well water availability
        const wellQuery = 'SELECT current_water FROM well_water WHERE city_id = $1';
        const wellResult = await client.query(wellQuery, [cityId]);
        
        if (wellResult.rows.length === 0 || wellResult.rows[0].current_water <= 0) {
          await client.query('ROLLBACK');
          return { success: false, message: 'No water available in the well', rationsTaken: 0 };
        }
        
        // Check daily ration limit
        const today = new Date().toISOString().split('T')[0];
        const rationQuery = `
          SELECT rations_taken FROM daily_water_rations 
          WHERE player_id = $1 AND city_id = $2 AND date = $3
        `;
        const rationResult = await client.query(rationQuery, [playerId, cityId, today]);
        
        const currentRations = rationResult.rows.length > 0 ? rationResult.rows[0].rations_taken : 0;
        
        // Check if pump exists to determine max rations per day
        const pumpQuery = `
          SELECT COUNT(*) as pump_count FROM buildings 
          WHERE city_id = $1 AND type = 'pump'
        `;
        const pumpResult = await client.query(pumpQuery, [cityId]);
        const maxRationsPerDay = pumpResult.rows[0].pump_count > 0 ? 2 : 1;
        
        if (currentRations >= maxRationsPerDay) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            message: `You have already taken your ${maxRationsPerDay} water ration${maxRationsPerDay > 1 ? 's' : ''} for today`, 
            rationsTaken: currentRations 
          };
        }
        
        // Take water ration
        const updateWellQuery = `
          UPDATE well_water 
          SET current_water = current_water - 1, updated_at = NOW()
          WHERE city_id = $1
        `;
        await client.query(updateWellQuery, [cityId]);
        
        // Update or insert daily ration record
        if (rationResult.rows.length > 0) {
          const updateRationQuery = `
            UPDATE daily_water_rations 
            SET rations_taken = rations_taken + 1
            WHERE player_id = $1 AND city_id = $2 AND date = $3
          `;
          await client.query(updateRationQuery, [playerId, cityId, today]);
        } else {
          const insertRationQuery = `
            INSERT INTO daily_water_rations (player_id, city_id, rations_taken, date)
            VALUES ($1, $2, 1, $3)
          `;
          await client.query(insertRationQuery, [playerId, cityId, today]);
        }
        
        await client.query('COMMIT');
        
        const newRationsTaken = currentRations + 1;
        const isSecondRation = newRationsTaken === 2;
        const message = isSecondRation ? 
          'You have taken your second water ration of the day' : 
          'You have taken a water ration';
        
        return { success: true, message, rationsTaken: newRationsTaken };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error taking water ration:', error);
      return { success: false, message: 'Failed to take water ration', rationsTaken: 0 };
    }
  }

  // Helper method to map database rows to project objects
  private mapRowsToProjects(rows: any[]): ConstructionProject[] {
    const projectMap = new Map<string, ConstructionProject>();
    
    for (const row of rows) {
      if (!projectMap.has(row.id)) {
        projectMap.set(row.id, {
          id: row.id,
          cityId: row.city_id,
          projectType: row.project_type,
          projectName: row.project_name,
          description: row.description,
          category: row.category,
          subCategory: row.sub_category,
          totalApRequired: row.total_ap_required,
          currentApProgress: row.current_ap_progress,
          isVisitable: row.is_visitable,
          defenseBonus: row.defense_bonus,
          isCompleted: row.is_completed,
          completedAt: row.completed_at,
          materialRequirements: []
        });
      }
      
      // Add material requirement if it exists
      if (row.mat_id) {
        const project = projectMap.get(row.id)!;
        project.materialRequirements.push({
          id: row.mat_id,
          projectId: row.id,
          itemName: row.item_name,
          requiredQuantity: row.required_quantity
        });
      }
    }
    
    return Array.from(projectMap.values());
  }
}