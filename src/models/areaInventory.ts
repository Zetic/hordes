import { InventoryItem, Location, Item } from '../types/game';
import { DatabaseService } from '../services/database';
import { ItemService } from './item';

export class AreaInventoryService {
  private db: DatabaseService;
  private itemService: ItemService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.itemService = new ItemService();
  }

  // Generate location string for grid-based locations
  private getLocationString(location: Location, x?: number, y?: number): string {
    if ((location === Location.GATE || location === Location.WASTE || location === Location.GREATER_WASTE) 
        && x !== undefined && y !== undefined) {
      return `${location}_${x}_${y}`;
    }
    return location;
  }

  // Get all items in a specific area
  async getAreaInventory(location: Location, x?: number, y?: number): Promise<Array<InventoryItem & { item: Item }>> {
    try {
      const locationString = this.getLocationString(location, x, y);
      const query = `
        SELECT ai.item_id, ai.quantity, items.name, items.type, items.description, items.weight
        FROM area_inventories ai
        JOIN items ON ai.item_id = items.id
        WHERE ai.location = $1
        ORDER BY items.name
      `;
      const result = await this.db.pool.query(query, [locationString]);
      
      return result.rows.map(row => ({
        itemId: row.item_id,
        quantity: row.quantity,
        item: {
          id: row.item_id,
          name: row.name,
          type: row.type,
          description: row.description,
          weight: row.weight
        }
      }));
    } catch (error) {
      console.error('Error getting area inventory:', error);
      return [];
    }
  }

  // Add item to an area
  async addItemToArea(location: Location, itemId: string, quantity: number = 1, x?: number, y?: number): Promise<boolean> {
    try {
      const locationString = this.getLocationString(location, x, y);
      // Check if this item already exists in the area
      const existingQuery = 'SELECT * FROM area_inventories WHERE location = $1 AND item_id = $2';
      const existingResult = await this.db.pool.query(existingQuery, [locationString, itemId]);

      if (existingResult.rows.length > 0) {
        // Update existing item quantity
        const updateQuery = `
          UPDATE area_inventories 
          SET quantity = quantity + $3 
          WHERE location = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [locationString, itemId, quantity]);
      } else {
        // Add new item to area
        const insertQuery = `
          INSERT INTO area_inventories (location, item_id, quantity)
          VALUES ($1, $2, $3)
        `;
        await this.db.pool.query(insertQuery, [locationString, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error adding item to area:', error);
      return false;
    }
  }

  // Remove item from an area
  async removeItemFromArea(location: Location, itemId: string, quantity: number = 1, x?: number, y?: number): Promise<boolean> {
    try {
      const locationString = this.getLocationString(location, x, y);
      // Check if area has the item
      const checkQuery = 'SELECT quantity FROM area_inventories WHERE location = $1 AND item_id = $2';
      const checkResult = await this.db.pool.query(checkQuery, [locationString, itemId]);

      if (checkResult.rows.length === 0) {
        return false; // Area doesn't have this item
      }

      const currentQuantity = checkResult.rows[0].quantity;
      if (currentQuantity < quantity) {
        return false; // Not enough quantity
      }

      if (currentQuantity === quantity) {
        // Remove the item completely
        const deleteQuery = 'DELETE FROM area_inventories WHERE location = $1 AND item_id = $2';
        await this.db.pool.query(deleteQuery, [locationString, itemId]);
      } else {
        // Reduce quantity
        const updateQuery = `
          UPDATE area_inventories 
          SET quantity = quantity - $3 
          WHERE location = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [locationString, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error removing item from area:', error);
      return false;
    }
  }

  // Check if area has a specific item
  async hasItem(location: Location, itemId: string, requiredQuantity: number = 1, x?: number, y?: number): Promise<boolean> {
    try {
      const locationString = this.getLocationString(location, x, y);
      const query = 'SELECT quantity FROM area_inventories WHERE location = $1 AND item_id = $2';
      const result = await this.db.pool.query(query, [locationString, itemId]);

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].quantity >= requiredQuantity;
    } catch (error) {
      console.error('Error checking if area has item:', error);
      return false;
    }
  }
}