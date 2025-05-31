import { Item, ItemType, InventoryItem } from '../types/game';
import { DatabaseService } from '../services/database';
import { ItemDefinition, getItemDefinition } from '../data/items';

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
      // Check if the error is related to missing columns
      if (error instanceof Error && error.message.includes('column') && error.message.includes('does not exist')) {
        console.error('❌ Database schema error - missing columns in items table:', error.message);
        console.error('This indicates the database schema may not have been properly initialized.');
        console.error('Please ensure the database schema includes all required columns for items.');
      } else {
        console.error('Error creating item:', error);
      }
      return null;
    }
  }

  // Create item from definition (admin function)
  async createItemFromDefinition(definition: ItemDefinition): Promise<Item | null> {
    try {
      // Check if item already exists
      const existing = await this.getItemByName(definition.name);
      if (existing) {
        console.log(`Item ${definition.name} already exists, skipping creation`);
        return existing;
      }

      // Extract legacy properties from first effect if it's a kill zombie effect
      let killChance: number | undefined;
      let breakChance: number | undefined;
      let transformInto: string | undefined;

      const killEffect = definition.effects.find(e => e.type === 'kill_zombie');
      if (killEffect) {
        killChance = killEffect.chance;
        breakChance = killEffect.breakChance;
        transformInto = killEffect.transformInto;
      }

      return await this.createItem(
        definition.name,
        definition.type,
        definition.description,
        definition.weight,
        definition.category,
        definition.subCategory,
        killChance,
        breakChance,
        killEffect?.value, // kill count
        transformInto,
        false // not broken by default
      );
    } catch (error) {
      console.error('Error creating item from definition:', error);
      return null;
    }
  }
  // Initialize default items if they don't exist
  async initializeDefaultItems(): Promise<void> {
    try {
      // Verify database schema before attempting item creation
      const isSchemaValid = await this.db.isItemsSchemaValid();
      if (!isSchemaValid) {
        throw new Error('Items table schema is not properly configured. Missing required columns.');
      }

      // Remove all dependent records first to avoid foreign key constraint violations
      try {
        await this.db.pool.query('DELETE FROM area_inventories');
        console.log('🗑️ Cleared area inventories');
      } catch (error) {
        console.warn('Warning: Could not clear area_inventories:', error);
      }

      try {
        await this.db.pool.query('DELETE FROM inventory');
        console.log('🗑️ Cleared player inventories');
      } catch (error) {
        console.warn('Warning: Could not clear inventory:', error);
      }

      try {
        await this.db.pool.query('DELETE FROM bank_inventories');
        console.log('🗑️ Cleared bank inventories');
      } catch (error) {
        console.warn('Warning: Could not clear bank_inventories:', error);
      }

      // Now remove all existing items
      await this.db.pool.query('DELETE FROM items');
      console.log('🗑️ Cleared existing items');

      // Create all items from definitions
      const { getAllItemDefinitions } = require('../data/items');
      const allDefinitions = getAllItemDefinitions();
      
      let createdCount = 0;
      for (const definition of allDefinitions) {
        const created = await this.createItemFromDefinition(definition);
        if (created) {
          console.log(`✅ ${definition.name} created from definition`);
          createdCount++;
        } else {
          console.error(`❌ Failed to create ${definition.name}`);
        }
      }

      console.log(`✅ ${createdCount} items initialized from definitions`);
    } catch (error) {
      console.error('Error initializing default items:', error);
    }
  }

  private mapRowToItem(row: any): Item {
    const item: Item = {
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

    // Try to get effects from item definition if available
    const definition = getItemDefinition(item.name);
    if (definition && definition.effects) {
      item.effects = definition.effects.map(effect => ({
        type: effect.type,
        value: effect.value,
        chance: effect.chance,
        breakChance: effect.breakChance,
        transformInto: effect.transformInto
      }));
    }

    return item;
  }
}