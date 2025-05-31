import { ZoneStatus, ZoneContest } from '../types/game';
import { DatabaseService } from './database';
import { PlayerService } from '../models/player';
import { ZombieService } from './zombieService';

export class ZoneContestService {
  private static instance: ZoneContestService;
  private db: DatabaseService;
  private playerService: PlayerService;
  private zombieService: ZombieService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.playerService = new PlayerService();
    this.zombieService = ZombieService.getInstance();
  }

  static getInstance(): ZoneContestService {
    if (!ZoneContestService.instance) {
      ZoneContestService.instance = new ZoneContestService();
    }
    return ZoneContestService.instance;
  }

  /**
   * Calculate control points for a zone
   * Zombies: +1 CP each
   * Players: +2 CP each
   */
  async calculateControlPoints(x: number, y: number): Promise<{ humanCp: number; zombieCp: number }> {
    try {
      // Get players at location
      const players = await this.playerService.getPlayersByCoordinates(x, y);
      const humanCp = players.length * 2; // 2 CP per player

      // Get zombies at location
      const zombies = await this.zombieService.getZombiesAtLocation(x, y);
      const zombieCp = zombies ? zombies.count : 0; // 1 CP per zombie

      return { humanCp, zombieCp };
    } catch (error) {
      console.error('Error calculating control points:', error);
      return { humanCp: 0, zombieCp: 0 };
    }
  }

  /**
   * Check if a player can move out of their current zone
   */
  async canPlayerMoveOut(x: number, y: number): Promise<{ canMove: boolean; reason?: string }> {
    try {
      const contest = await this.getZoneContest(x, y);
      
      // Players can move out of uncontested or temporarily uncontested zones
      if (contest.status === ZoneStatus.UNCONTESTED || contest.status === ZoneStatus.TEMPORARILY_UNCONTESTED) {
        return { canMove: true };
      }

      // Players cannot move out of contested zones
      if (contest.status === ZoneStatus.CONTESTED) {
        return { 
          canMove: false, 
          reason: 'You cannot leave this zone - it is contested by zombies! The zone must become uncontested before you can move.'
        };
      }

      return { canMove: true };
    } catch (error) {
      console.error('Error checking player movement:', error);
      return { canMove: true }; // Default to allowing movement on error
    }
  }

  /**
   * Check if players in a zone are trapped (in contested zone)
   */
  async arePlayersTrapped(x: number, y: number): Promise<boolean> {
    try {
      const contest = await this.getZoneContest(x, y);
      return contest.status === ZoneStatus.CONTESTED;
    } catch (error) {
      console.error('Error checking if players are trapped:', error);
      return false;
    }
  }

  /**
   * Get zone contest status, creating if doesn't exist
   */
  async getZoneContest(x: number, y: number): Promise<ZoneContest> {
    try {
      const query = 'SELECT * FROM zone_contests WHERE x = $1 AND y = $2';
      const result = await this.db.pool.query(query, [x, y]);

      if (result.rows.length > 0) {
        return this.mapRowToZoneContest(result.rows[0]);
      }

      // Create new zone contest entry
      return await this.createZoneContest(x, y);
    } catch (error) {
      console.error('Error getting zone contest:', error);
      // Return default uncontested zone
      return {
        x,
        y,
        status: ZoneStatus.UNCONTESTED,
        humanCp: 0,
        zombieCp: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Create new zone contest entry
   */
  private async createZoneContest(x: number, y: number): Promise<ZoneContest> {
    const { humanCp, zombieCp } = await this.calculateControlPoints(x, y);
    const status = humanCp >= zombieCp ? ZoneStatus.UNCONTESTED : ZoneStatus.CONTESTED;

    const query = `
      INSERT INTO zone_contests (x, y, status, human_cp, zombie_cp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await this.db.pool.query(query, [x, y, status, humanCp, zombieCp]);
      return this.mapRowToZoneContest(result.rows[0]);
    } catch (error) {
      console.error('Error creating zone contest:', error);
      // Return default uncontested zone
      return {
        x,
        y,
        status: ZoneStatus.UNCONTESTED,
        humanCp,
        zombieCp,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Update zone contest status based on current control points
   */
  async updateZoneContest(x: number, y: number): Promise<ZoneContest> {
    const { humanCp, zombieCp } = await this.calculateControlPoints(x, y);
    const currentContest = await this.getZoneContest(x, y);

    let newStatus = currentContest.status;
    let tempUncontestedUntil: Date | undefined;

    // Determine new status based on CP balance
    if (humanCp >= zombieCp) {
      // Humans have control
      if (currentContest.status === ZoneStatus.CONTESTED) {
        // Zone becomes uncontested
        newStatus = ZoneStatus.UNCONTESTED;
      } else {
        // Already uncontested or temporarily uncontested, keep as uncontested
        newStatus = ZoneStatus.UNCONTESTED;
      }
    } else {
      // Zombies have more control
      if (currentContest.status === ZoneStatus.UNCONTESTED) {
        // Zone becomes temporarily uncontested for 30 minutes
        newStatus = ZoneStatus.TEMPORARILY_UNCONTESTED;
        tempUncontestedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      } else if (currentContest.status === ZoneStatus.TEMPORARILY_UNCONTESTED) {
        // Check if timer has expired
        if (currentContest.tempUncontestedUntil && new Date() > currentContest.tempUncontestedUntil) {
          newStatus = ZoneStatus.CONTESTED;
          tempUncontestedUntil = undefined;
        } else {
          // Keep temporarily uncontested
          newStatus = ZoneStatus.TEMPORARILY_UNCONTESTED;
          tempUncontestedUntil = currentContest.tempUncontestedUntil;
        }
      } else {
        // Already contested
        newStatus = ZoneStatus.CONTESTED;
      }
    }

    // Update database
    const query = `
      UPDATE zone_contests 
      SET status = $1, human_cp = $2, zombie_cp = $3, temp_uncontested_until = $4, updated_at = NOW()
      WHERE x = $5 AND y = $6
      RETURNING *
    `;

    try {
      const result = await this.db.pool.query(query, [
        newStatus, 
        humanCp, 
        zombieCp, 
        tempUncontestedUntil, 
        x, 
        y
      ]);

      if (result.rows.length > 0) {
        return this.mapRowToZoneContest(result.rows[0]);
      }
    } catch (error) {
      console.error('Error updating zone contest:', error);
    }

    // Return updated contest data
    return {
      x,
      y,
      status: newStatus,
      humanCp,
      zombieCp,
      tempUncontestedUntil,
      lastUpdated: new Date()
    };
  }

  /**
   * Process expired temporarily uncontested zones (to be called periodically)
   */
  async processExpiredTemporaryZones(): Promise<void> {
    try {
      const query = `
        UPDATE zone_contests 
        SET status = $1, temp_uncontested_until = NULL, updated_at = NOW()
        WHERE status = $2 AND temp_uncontested_until <= NOW()
      `;
      
      await this.db.pool.query(query, [ZoneStatus.CONTESTED, ZoneStatus.TEMPORARILY_UNCONTESTED]);
    } catch (error) {
      console.error('Error processing expired temporary zones:', error);
    }
  }

  /**
   * Trigger contest check when player enters a zone
   */
  async onPlayerEnterZone(x: number, y: number): Promise<ZoneContest> {
    return await this.updateZoneContest(x, y);
  }

  /**
   * Trigger contest check when player leaves a zone (if not already contested)
   */
  async onPlayerLeaveZone(x: number, y: number): Promise<ZoneContest> {
    const currentContest = await this.getZoneContest(x, y);
    
    // Only update if zone is not already contested
    if (currentContest.status !== ZoneStatus.CONTESTED) {
      return await this.updateZoneContest(x, y);
    }
    
    return currentContest;
  }

  private mapRowToZoneContest(row: any): ZoneContest {
    return {
      x: row.x,
      y: row.y,
      status: row.status as ZoneStatus,
      humanCp: row.human_cp,
      zombieCp: row.zombie_cp,
      tempUncontestedUntil: row.temp_uncontested_until ? new Date(row.temp_uncontested_until) : undefined,
      lastUpdated: new Date(row.updated_at)
    };
  }
}