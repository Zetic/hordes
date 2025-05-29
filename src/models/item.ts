import { Item, ItemType, InventoryItem } from '../types/game';
import { DatabaseService } from '../services/database';

export class ItemService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  // Get item by ID
  async getItem(itemId: string): Promise<Item | null> {
    try {
      const query = 'SELECT * FROM items WHERE id = $1';
      const result = await this.db.pool.query(query, [itemId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToItem(result.rows[0]);
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    }
  }

  // Get item by name (for user commands)
  async getItemByName(name: string): Promise<Item | null> {
    try {
      const query = 'SELECT * FROM items WHERE LOWER(name) = LOWER($1)';
      const result = await this.db.pool.query(query, [name]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToItem(result.rows[0]);
    } catch (error) {
      console.error('Error getting item by name:', error);
      return null;
    }
  }

  // Create a new item (admin function)
  async createItem(name: string, type: ItemType, description: string, weight: number = 1): Promise<Item | null> {
    try {
      const query = `
        INSERT INTO items (name, type, description, weight)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await this.db.pool.query(query, [name, type, description, weight]);
      
      return this.mapRowToItem(result.rows[0]);
    } catch (error) {
      console.error('Error creating item:', error);
      return null;
    }
  }

  // Initialize default items if they don't exist
  async initializeDefaultItems(): Promise<void> {
    try {
      const defaultItems = [
        { name: 'Wood', type: ItemType.BUILDING_MATERIAL, description: 'Basic construction material', weight: 1 },
        { name: 'Metal Scraps', type: ItemType.BUILDING_MATERIAL, description: 'Scavenged metal pieces', weight: 1 },
        { name: 'Water Bottle', type: ItemType.CONSUMABLE, description: 'Clean drinking water', weight: 1 },
        { name: 'Canned Food', type: ItemType.CONSUMABLE, description: 'Non-perishable food', weight: 1 },
        { name: 'Tools', type: ItemType.TOOL, description: 'Basic repair tools', weight: 1 },
        { name: 'Oil Barrel', type: ItemType.RESOURCE, description: 'Fuel for generators', weight: 2 },
        { name: 'Weapon Parts', type: ItemType.WEAPON, description: 'Components for making weapons', weight: 1 },
        { name: 'Sturdy Wood', type: ItemType.BUILDING_MATERIAL, description: 'High-quality construction material', weight: 1 }
      ];

      for (const item of defaultItems) {
        // Check if item already exists
        const existing = await this.getItemByName(item.name);
        if (!existing) {
          await this.createItem(item.name, item.type, item.description, item.weight);
        }
      }

      console.log('✅ Default items initialized');
    } catch (error) {
      console.error('Error initializing default items:', error);
    }
  }

  private mapRowToItem(row: any): Item {
    return {
      id: row.id,
      name: row.name,
      type: row.type as ItemType,
      description: row.description,
      weight: row.weight
    };
  }
}