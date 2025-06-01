import { DatabaseService } from './database';
import { ItemService } from '../models/item';
import { InventoryService } from '../models/inventory';
import { AreaInventoryService } from '../models/areaInventory';
import { PlayerService } from '../models/player';
import { ItemDefinition, getAllItemDefinitions } from '../data/items';
import { Location, PlayerStatus } from '../types/game';
import { Client, EmbedBuilder } from 'discord.js';

export interface ScavengeResult {
  success: boolean;
  item?: {
    name: string;
    description: string;
  };
  addedToInventory?: boolean;
  areaInfo: {
    totalRolls: number;
    isNearDepletion: boolean;
    isDepleted: boolean;
  };
}

export interface AreaScavengingInfo {
  x: number;
  y: number;
  totalRolls: number;
  isActive: boolean;
  lastRollTime?: Date;
}

export class ScavengingService {
  private static instance: ScavengingService;
  private db: DatabaseService;
  private itemService: ItemService;
  private inventoryService: InventoryService;
  private areaInventoryService: AreaInventoryService;
  private playerService: PlayerService;
  private scavengingTimer?: NodeJS.Timeout;
  private discordClient: Client | null = null;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.itemService = new ItemService();
    this.inventoryService = new InventoryService();
    this.areaInventoryService = new AreaInventoryService();
    this.playerService = new PlayerService();
    this.initializeScavengingTimer();
  }

  static getInstance(): ScavengingService {
    if (!ScavengingService.instance) {
      ScavengingService.instance = new ScavengingService();
    }
    return ScavengingService.instance;
  }

  public setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  // Initialize 5-minute timer for automatic scavenging
  private initializeScavengingTimer(): void {
    // Run every 5 minutes (300000 milliseconds)
    this.scavengingTimer = setInterval(async () => {
      await this.performAutoScavenging();
    }, 300000);
    
    console.log('✅ Scavenging timer initialized - runs every 5 minutes');
  }

  // Get loot pool for an area (all areas use same pool for now)
  private getLootPool(location: Location, isDepleted: boolean = false): ItemDefinition[] {
    const allItems = getAllItemDefinitions();
    
    if (isDepleted) {
      // Depleted areas only have Rotten Log and Scrap Metal
      return allItems.filter(item => 
        item.name === 'Rotten Log' || item.name === 'Scrap Metal'
      );
    }
    
    // Regular loot pool includes existing items + all resources
    return allItems.filter(item => 
      // Existing implemented items
      item.name === 'Box Cutter' ||
      item.name === 'Stale Tart' ||
      item.name === 'Bandage' ||
      item.name === 'Water Ration' ||
      // All resource items
      item.category === 'Resources'
    );
  }

  // Check if player has already scavenged in this area
  async hasPlayerScavengedInArea(playerId: string, x: number, y: number): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM player_area_scavenging 
        WHERE player_id = $1 AND x = $2 AND y = $3
      `;
      const result = await this.db.pool.query(query, [playerId, x, y]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error checking if player has scavenged in area:', error);
      return false;
    }
  }

  // Mark that a player has scavenged in this area
  async markPlayerScavengedInArea(playerId: string, x: number, y: number): Promise<void> {
    try {
      const query = `
        INSERT INTO player_area_scavenging (player_id, x, y, scavenged_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (player_id, x, y) DO NOTHING
      `;
      await this.db.pool.query(query, [playerId, x, y]);
    } catch (error) {
      console.error('Error marking player as scavenged in area:', error);
    }
  }

  // Get area scavenging info
  async getAreaScavengingInfo(x: number, y: number): Promise<AreaScavengingInfo> {
    try {
      const query = `
        SELECT * FROM area_scavenging 
        WHERE x = $1 AND y = $2
      `;
      const result = await this.db.pool.query(query, [x, y]);
      
      if (result.rows.length === 0) {
        return {
          x,
          y,
          totalRolls: 0,
          isActive: false
        };
      }
      
      const row = result.rows[0];
      return {
        x: row.x,
        y: row.y,
        totalRolls: row.total_rolls,
        isActive: row.is_active,
        lastRollTime: row.last_roll_time
      };
    } catch (error) {
      console.error('Error getting area scavenging info:', error);
      return {
        x,
        y,
        totalRolls: 0,
        isActive: false
      };
    }
  }

  // Mark area as being actively scavenged
  async markAreaAsScavenged(x: number, y: number): Promise<void> {
    try {
      const query = `
        INSERT INTO area_scavenging (x, y, total_rolls, is_active, last_roll_time)
        VALUES ($1, $2, 0, true, NOW())
        ON CONFLICT (x, y) DO UPDATE SET
          is_active = true,
          last_roll_time = NOW()
      `;
      await this.db.pool.query(query, [x, y]);
    } catch (error) {
      console.error('Error marking area as scavenged:', error);
    }
  }

  // Increment area roll count
  async incrementAreaRollCount(x: number, y: number): Promise<number> {
    try {
      const query = `
        UPDATE area_scavenging 
        SET total_rolls = total_rolls + 1, last_roll_time = NOW()
        WHERE x = $1 AND y = $2
        RETURNING total_rolls
      `;
      const result = await this.db.pool.query(query, [x, y]);
      return result.rows[0]?.total_rolls || 0;
    } catch (error) {
      console.error('Error incrementing area roll count:', error);
      return 0;
    }
  }

  // Perform a scavenge roll
  async performScavenge(playerId: string, x: number, y: number, sendNotification: boolean = false): Promise<ScavengeResult> {
    try {
      // Get area info
      const areaInfo = await this.getAreaScavengingInfo(x, y);
      
      // Check if area is depleted (4-6 rolls)
      const depletionThreshold = 4 + Math.floor(Math.random() * 3); // 4-6
      const isDepleted = areaInfo.totalRolls >= depletionThreshold;
      const isNearDepletion = areaInfo.totalRolls >= depletionThreshold - 1;
      
      // Get player's location for loot pool
      const player = await this.playerService.getPlayerById(playerId);
      if (!player) {
        return {
          success: false,
          areaInfo: {
            totalRolls: areaInfo.totalRolls,
            isNearDepletion,
            isDepleted
          }
        };
      }
      
      // Get loot pool
      const lootPool = this.getLootPool(player.location, isDepleted);
      
      if (lootPool.length === 0) {
        return {
          success: true,
          areaInfo: {
            totalRolls: areaInfo.totalRolls,
            isNearDepletion,
            isDepleted
          }
        };
      }
      
      // Randomly select an item
      const randomItem = lootPool[Math.floor(Math.random() * lootPool.length)];
      
      // Try to create/get the item
      let item = await this.itemService.getItemByName(randomItem.name);
      if (!item) {
        item = await this.itemService.createItemFromDefinition(randomItem);
      }
      
      if (!item) {
        return {
          success: false,
          areaInfo: {
            totalRolls: areaInfo.totalRolls,
            isNearDepletion,
            isDepleted
          }
        };
      }
      
      // Try to add to inventory first
      let addedToInventory = false;
      const inventorySuccess = await this.inventoryService.addItemToInventory(player.id, item.id, 1);
      
      if (inventorySuccess) {
        addedToInventory = true;
      } else {
        // Add to area inventory if player inventory is full
        await this.areaInventoryService.addItemToArea(player.location, item.id, 1, player.x!, player.y!);
      }
      
      // Increment area roll count
      const newRollCount = await this.incrementAreaRollCount(x, y);
      
      // Send notification if requested and item was found
      if (sendNotification) {
        await this.sendItemDiscoveryNotification(player.name, item.name, x, y);
      }
      
      return {
        success: true,
        item: {
          name: item.name,
          description: item.description
        },
        addedToInventory,
        areaInfo: {
          totalRolls: newRollCount,
          isNearDepletion: newRollCount >= depletionThreshold - 1,
          isDepleted: newRollCount >= depletionThreshold
        }
      };
      
    } catch (error) {
      console.error('Error performing scavenge:', error);
      return {
        success: false,
        areaInfo: {
          totalRolls: 0,
          isNearDepletion: false,
          isDepleted: false
        }
      };
    }
  }

  // Perform automatic scavenging for all players with scavenging condition
  private async performAutoScavenging(): Promise<void> {
    try {
      console.log('🔍 Running automatic scavenging cycle...');
      
      // Get all players with scavenging condition
      const query = `
        SELECT DISTINCT p.id, p.discord_id, p.name, p.x, p.y, p.location
        FROM players p
        JOIN player_conditions pc ON p.id = pc.player_id
        WHERE pc.condition = $1 AND p.x IS NOT NULL AND p.y IS NOT NULL
      `;
      const result = await this.db.pool.query(query, [PlayerStatus.SCAVENGING]);
      
      console.log(`Found ${result.rows.length} players actively scavenging`);
      
      for (const row of result.rows) {
        const playerId = row.id;
        const playerName = row.name;
        const x = row.x;
        const y = row.y;
        
        console.log(`Processing auto-scavenge for ${playerName} at (${x}, ${y})`);
        
        // Perform scavenge
        const scavengeResult = await this.performScavenge(playerId, x, y, true);
        
        if (scavengeResult.success && scavengeResult.item) {
          console.log(`${playerName} found ${scavengeResult.item.name} while scavenging`);
        }
      }
      
    } catch (error) {
      console.error('Error during automatic scavenging:', error);
    }
  }

  private async sendItemDiscoveryNotification(playerName: string, itemName: string, x: number, y: number): Promise<void> {
    try {
      // Create Discord embed for item discovery
      const embed = new EmbedBuilder()
        .setColor('#4ecdc4')
        .setTitle(`(${x}, ${y}) ${playerName} Found ${itemName}!`)
        .setTimestamp();

      // Send to Discord channel if client and channel are available (use same channel as attack reports)
      if (this.discordClient && process.env.DISCORD_ATTACK_REPORT_CHANNEL_ID) {
        try {
          const channel = await this.discordClient.channels.fetch(process.env.DISCORD_ATTACK_REPORT_CHANNEL_ID);
          if (channel && channel.isTextBased() && 'send' in channel) {
            await channel.send({ embeds: [embed] });
            console.log('✅ Item discovery notification sent to Discord channel');
          } else {
            console.log('⚠️ Discord channel not found or not text-based');
          }
        } catch (discordError) {
          console.error('❌ Failed to send item discovery notification to Discord:', discordError);
        }
      } else {
        console.log('⚠️ Discord client or attack report channel ID not configured, skipping Discord message');
      }
      
    } catch (error) {
      console.error('Error sending item discovery notification:', error);
    }
  }

  // Clean up timer when shutting down
  destroy(): void {
    if (this.scavengingTimer) {
      clearInterval(this.scavengingTimer);
      this.scavengingTimer = undefined;
    }
  }
}