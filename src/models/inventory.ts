import { InventoryItem, Item } from '../types/game';
import { DatabaseService } from '../services/database';
import { ItemService } from './item';

export class InventoryService {
  private db: DatabaseService;
  private itemService: ItemService;
  
  // Inventory limits
  private static readonly MAX_INVENTORY_SIZE = 3;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.itemService = new ItemService();
  }

  // Get player's inventory
  async getPlayerInventory(playerId: string): Promise<InventoryItem[]> {
    try {
      const query = `
        SELECT i.item_id, i.quantity, items.name, items.type, items.description, items.weight
        FROM inventory i
        JOIN items ON i.item_id = items.id
        WHERE i.player_id = $1
        ORDER BY items.name
      `;
      const result = await this.db.pool.query(query, [playerId]);
      
      return result.rows.map(row => ({
        itemId: row.item_id,
        quantity: row.quantity
      }));
    } catch (error) {
      console.error('Error getting player inventory:', error);
      return [];
    }
  }

  // Get detailed inventory with item information
  async getDetailedPlayerInventory(playerId: string): Promise<Array<InventoryItem & { item: Item }>> {
    try {
      const query = `
        SELECT i.item_id, i.quantity, items.name, items.type, items.description, items.weight
        FROM inventory i
        JOIN items ON i.item_id = items.id
        WHERE i.player_id = $1
        ORDER BY items.name
      `;
      const result = await this.db.pool.query(query, [playerId]);
      
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
      console.error('Error getting detailed player inventory:', error);
      return [];
    }
  }

  // Check if player is encumbered (has more than MAX_INVENTORY_SIZE items)
  async isPlayerEncumbered(playerId: string): Promise<boolean> {
    try {
      const inventory = await this.getPlayerInventory(playerId);
      const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
      return totalItems > InventoryService.MAX_INVENTORY_SIZE;
    } catch (error) {
      console.error('Error checking encumbrance:', error);
      return false;
    }
  }

  // Get total number of items in inventory
  async getInventoryCount(playerId: string): Promise<number> {
    try {
      const inventory = await this.getPlayerInventory(playerId);
      return inventory.reduce((sum, item) => sum + item.quantity, 0);
    } catch (error) {
      console.error('Error getting inventory count:', error);
      return 0;
    }
  }

  // Add item to player inventory
  async addItemToInventory(playerId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    try {
      // Check if this would exceed inventory limit
      const currentCount = await this.getInventoryCount(playerId);
      if (currentCount + quantity > InventoryService.MAX_INVENTORY_SIZE) {
        return false; // Would make player encumbered
      }

      // Check if player already has this item
      const existingQuery = 'SELECT * FROM inventory WHERE player_id = $1 AND item_id = $2';
      const existingResult = await this.db.pool.query(existingQuery, [playerId, itemId]);

      if (existingResult.rows.length > 0) {
        // Update existing item quantity
        const updateQuery = `
          UPDATE inventory 
          SET quantity = quantity + $3 
          WHERE player_id = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [playerId, itemId, quantity]);
      } else {
        // Add new item to inventory
        const insertQuery = `
          INSERT INTO inventory (player_id, item_id, quantity)
          VALUES ($1, $2, $3)
        `;
        await this.db.pool.query(insertQuery, [playerId, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error adding item to inventory:', error);
      return false;
    }
  }

  // Remove item from player inventory
  async removeItemFromInventory(playerId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    try {
      // Check if player has the item
      const checkQuery = 'SELECT quantity FROM inventory WHERE player_id = $1 AND item_id = $2';
      const checkResult = await this.db.pool.query(checkQuery, [playerId, itemId]);

      if (checkResult.rows.length === 0) {
        return false; // Player doesn't have this item
      }

      const currentQuantity = checkResult.rows[0].quantity;
      if (currentQuantity < quantity) {
        return false; // Not enough quantity
      }

      if (currentQuantity === quantity) {
        // Remove the item completely
        const deleteQuery = 'DELETE FROM inventory WHERE player_id = $1 AND item_id = $2';
        await this.db.pool.query(deleteQuery, [playerId, itemId]);
      } else {
        // Reduce quantity
        const updateQuery = `
          UPDATE inventory 
          SET quantity = quantity - $3 
          WHERE player_id = $1 AND item_id = $2
        `;
        await this.db.pool.query(updateQuery, [playerId, itemId, quantity]);
      }

      return true;
    } catch (error) {
      console.error('Error removing item from inventory:', error);
      return false;
    }
  }

  // Check if player has a specific item
  async hasItem(playerId: string, itemId: string, requiredQuantity: number = 1): Promise<boolean> {
    try {
      const query = 'SELECT quantity FROM inventory WHERE player_id = $1 AND item_id = $2';
      const result = await this.db.pool.query(query, [playerId, itemId]);

      if (result.rows.length === 0) {
        return false;
      }

      return result.rows[0].quantity >= requiredQuantity;
    } catch (error) {
      console.error('Error checking if player has item:', error);
      return false;
    }
  }

  // Clear all items from inventory (for admin/reset purposes)
  async clearInventory(playerId: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM inventory WHERE player_id = $1';
      await this.db.pool.query(query, [playerId]);
      return true;
    } catch (error) {
      console.error('Error clearing inventory:', error);
      return false;
    }
  }

  static getMaxInventorySize(): number {
    return InventoryService.MAX_INVENTORY_SIZE;
  }
}