import { InventoryItem, Item } from '../types/game';
import { DatabaseService } from '../services/database';
import { ItemService } from './item';

export class BankService {
  private db: DatabaseService;
  private itemService: ItemService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.itemService = new ItemService();
  }

  // Get all items in the bank for a specific city
  async getBankInventory(cityId: string): Promise<Array<InventoryItem & { item: Item }>> {
    try {
      const query = `
        SELECT bi.item_id, bi.quantity, items.name, items.type, items.description, items.weight
        FROM bank_inventories bi
        JOIN items ON bi.item_id = items.id
        WHERE bi.city_id = $1
        ORDER BY items.name
      `;
      const result = await this.db.pool.query(query, [cityId]);
      
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
      console.error('Error getting bank inventory:', error);
      return [];
    }
  }

  // Add item to bank
  async depositItem(cityId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    try {
      // Check if this item already exists in the bank
      const existingQuery = 'SELECT * FROM bank_inventories WHERE city_id = $1 AND item_id = $2';
      const existingResult = await this.db.pool.query(existingQuery, [cityId, itemId]);

      if (existingResult.rows.length > 0) {
        // Update existing item quantity
        const updateQuery = `
          UPDATE bank_inventories 
          SET quantity = quantity + $3 
          WHERE city_id = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [cityId, itemId, quantity]);
      } else {
        // Add new item to bank
        const insertQuery = `
          INSERT INTO bank_inventories (city_id, item_id, quantity)
          VALUES ($1, $2, $3)
        `;
        await this.db.pool.query(insertQuery, [cityId, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error depositing item to bank:', error);
      return false;
    }
  }

  // Remove item from bank
  async withdrawItem(cityId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    try {
      // Check if bank has the item
      const checkQuery = 'SELECT quantity FROM bank_inventories WHERE city_id = $1 AND item_id = $2';
      const checkResult = await this.db.pool.query(checkQuery, [cityId, itemId]);

      if (checkResult.rows.length === 0) {
        return false; // Bank doesn't have this item
      }

      const currentQuantity = checkResult.rows[0].quantity;
      if (currentQuantity < quantity) {
        return false; // Not enough quantity
      }

      if (currentQuantity === quantity) {
        // Remove the item completely
        const deleteQuery = 'DELETE FROM bank_inventories WHERE city_id = $1 AND item_id = $2';
        await this.db.pool.query(deleteQuery, [cityId, itemId]);
      } else {
        // Reduce quantity
        const updateQuery = `
          UPDATE bank_inventories 
          SET quantity = quantity - $3 
          WHERE city_id = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [cityId, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error withdrawing item from bank:', error);
      return false;
    }
  }

  // Check if bank has a specific item
  async hasItem(cityId: string, itemId: string, requiredQuantity: number = 1): Promise<boolean> {
    try {
      const query = 'SELECT quantity FROM bank_inventories WHERE city_id = $1 AND item_id = $2';
      const result = await this.db.pool.query(query, [cityId, itemId]);

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].quantity >= requiredQuantity;
    } catch (error) {
      console.error('Error checking if bank has item:', error);
      return false;
    }
  }

  // Get item from bank by name (for user commands)
  async getItemFromBankByName(cityId: string, itemName: string): Promise<(InventoryItem & { item: Item }) | null> {
    try {
      const query = `
        SELECT bi.item_id, bi.quantity, items.name, items.type, items.description, items.weight
        FROM bank_inventories bi
        JOIN items ON bi.item_id = items.id
        WHERE bi.city_id = $1 AND LOWER(items.name) = LOWER($2)
      `;
      const result = await this.db.pool.query(query, [cityId, itemName]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        itemId: row.item_id,
        quantity: row.quantity,
        item: {
          id: row.item_id,
          name: row.name,
          type: row.type,
          description: row.description,
          weight: row.weight
        }
      };
    } catch (error) {
      console.error('Error getting item from bank by name:', error);
      return null;
    }
  }
}