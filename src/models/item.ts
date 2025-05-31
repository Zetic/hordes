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

  // Create a new item with extended properties (admin function)
  async createItem(
    name: string, 
    type: ItemType, 
    description: string, 
    weight: number = 1,
    category?: string,
    subCategory?: string,
    killChance?: number,
    breakChance?: number,
    killCount?: number,
    onBreak?: string,
    broken: boolean = false
  ): Promise<Item | null> {
    try {
      const query = `
        INSERT INTO items (name, type, description, weight, category, sub_category, kill_chance, break_chance, kill_count, on_break, broken)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      const result = await this.db.pool.query(query, [
        name, type, description, weight, category, subCategory, killChance, breakChance, killCount, onBreak, broken
      ]);
      
      return this.mapRowToItem(result.rows[0]);
    } catch (error) {
      console.error('Error creating item:', error);
      return null;
    }
  }

  // Initialize default items if they don't exist (Box Cutter only)
  async initializeDefaultItems(): Promise<void> {
    try {
      // Remove all existing items first to clean up
      await this.db.pool.query('DELETE FROM items');
      console.log('🗑️ Cleared existing items');

      // Create Box Cutter
      const boxCutter = await this.getItemByName('Box Cutter');
      if (!boxCutter) {
        await this.createItem(
          'Box Cutter',
          ItemType.MELEE,
          'A sharp utility knife that can be used to kill zombies',
          1,
          'Items',
          'Armoury',
          60, // 60% kill chance
          70, // 70% break chance
          1,  // kills 1 zombie
          'Broken' // becomes broken on break
        );
        console.log('✅ Box Cutter created');
      }

      // Create Broken Box Cutter
      const brokenBoxCutter = await this.getItemByName('Broken Box Cutter');
      if (!brokenBoxCutter) {
        await this.createItem(
          'Broken Box Cutter',
          ItemType.MELEE,
          'A broken utility knife with no use',
          1,
          'Items',
          'Armoury',
          undefined,
          undefined,
          undefined,
          undefined,
          true // broken
        );
        console.log('✅ Broken Box Cutter created');
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
      weight: row.weight,
      category: row.category,
      subCategory: row.sub_category,
      killChance: row.kill_chance,
      breakChance: row.break_chance,
      killCount: row.kill_count,
      onBreak: row.on_break,
      broken: row.broken || false
    };
  }
}