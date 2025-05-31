import { ZoneContestService } from '../services/zoneContest';
import { ZoneStatus } from '../types/game';

// Mock the dependencies
jest.mock('../services/database');
jest.mock('../models/player');
jest.mock('../services/zombieService');

describe('Zone Contest System', () => {
  let zoneContestService: ZoneContestService;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
    
    // Reset singleton instance
    (ZoneContestService as any).instance = null;
    zoneContestService = ZoneContestService.getInstance();
  });

  describe('Control Points Calculation', () => {
    test('should calculate human CP correctly (2 CP per player)', async () => {
      // Mock PlayerService.getPlayersByCoordinates to return 2 players
      const mockPlayerService = require('../models/player').PlayerService;
      mockPlayerService.prototype.getPlayersByCoordinates = jest.fn().mockResolvedValue([
        { id: '1', name: 'Player1' },
        { id: '2', name: 'Player2' }
      ]);

      // Mock ZombieService.getZombiesAtLocation to return no zombies
      const mockZombieService = require('../services/zombieService').ZombieService;
      mockZombieService.getInstance = jest.fn().mockReturnValue({
        getZombiesAtLocation: jest.fn().mockResolvedValue(null)
      });

      const result = await zoneContestService.calculateControlPoints(5, 5);
      
      expect(result.humanCp).toBe(4); // 2 players * 2 CP each
      expect(result.zombieCp).toBe(0); // No zombies
    });

    test('should calculate zombie CP correctly (1 CP per zombie)', async () => {
      // Mock PlayerService.getPlayersByCoordinates to return no players
      const mockPlayerService = require('../models/player').PlayerService;
      mockPlayerService.prototype.getPlayersByCoordinates = jest.fn().mockResolvedValue([]);

      // Mock ZombieService.getZombiesAtLocation to return 3 zombies
      const mockZombieService = require('../services/zombieService').ZombieService;
      mockZombieService.getInstance = jest.fn().mockReturnValue({
        getZombiesAtLocation: jest.fn().mockResolvedValue({ count: 3 })
      });

      const result = await zoneContestService.calculateControlPoints(5, 5);
      
      expect(result.humanCp).toBe(0); // No players
      expect(result.zombieCp).toBe(3); // 3 zombies * 1 CP each
    });
  });

  describe('Movement Restrictions', () => {
    test('should allow movement from uncontested zone', async () => {
      // Mock database to return uncontested zone
      const mockDb = require('../services/database').DatabaseService;
      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: {
          query: jest.fn().mockResolvedValue({
            rows: [{
              x: 5,
              y: 5,
              status: ZoneStatus.UNCONTESTED,
              human_cp: 4,
              zombie_cp: 2,
              temp_uncontested_until: null,
              updated_at: new Date()
            }]
          })
        }
      });

      const result = await zoneContestService.canPlayerMoveOut(5, 5);
      
      expect(result.canMove).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should prevent movement from contested zone', async () => {
      // Mock database to return contested zone
      const mockDb = require('../services/database').DatabaseService;
      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: {
          query: jest.fn().mockResolvedValue({
            rows: [{
              x: 5,
              y: 5,
              status: ZoneStatus.CONTESTED,
              human_cp: 2,
              zombie_cp: 4,
              temp_uncontested_until: null,
              updated_at: new Date()
            }]
          })
        }
      });

      const result = await zoneContestService.canPlayerMoveOut(5, 5);
      
      expect(result.canMove).toBe(false);
      expect(result.reason).toContain('contested');
    });

    test('should allow movement from temporarily uncontested zone', async () => {
      // Mock database to return temporarily uncontested zone
      const mockDb = require('../services/database').DatabaseService;
      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: {
          query: jest.fn().mockResolvedValue({
            rows: [{
              x: 5,
              y: 5,
              status: ZoneStatus.TEMPORARILY_UNCONTESTED,
              human_cp: 2,
              zombie_cp: 4,
              temp_uncontested_until: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes in future
              updated_at: new Date()
            }]
          })
        }
      });

      const result = await zoneContestService.canPlayerMoveOut(5, 5);
      
      expect(result.canMove).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('Zone Status Logic', () => {
    test('should detect trapped players in contested zone', async () => {
      // Mock database to return contested zone
      const mockDb = require('../services/database').DatabaseService;
      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: {
          query: jest.fn().mockResolvedValue({
            rows: [{
              x: 5,
              y: 5,
              status: ZoneStatus.CONTESTED,
              human_cp: 2,
              zombie_cp: 4,
              temp_uncontested_until: null,
              updated_at: new Date()
            }]
          })
        }
      });

      const isTrapped = await zoneContestService.arePlayersTrapped(5, 5);
      
      expect(isTrapped).toBe(true);
    });

    test('should not detect trapped players in uncontested zone', async () => {
      // Mock database to return uncontested zone
      const mockDb = require('../services/database').DatabaseService;
      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: {
          query: jest.fn().mockResolvedValue({
            rows: [{
              x: 5,
              y: 5,
              status: ZoneStatus.UNCONTESTED,
              human_cp: 4,
              zombie_cp: 2,
              temp_uncontested_until: null,
              updated_at: new Date()
            }]
          })
        }
      });

      const isTrapped = await zoneContestService.arePlayersTrapped(5, 5);
      
      expect(isTrapped).toBe(false);
    });
  });

  describe('Zone Contest Creation', () => {
    test('should create uncontested zone when humans have equal or more CP', async () => {
      // Mock database for both SELECT (no existing contest) and INSERT operations
      const mockDb = require('../services/database').DatabaseService;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // No existing contest
        .mockResolvedValueOnce({ // Insert new contest
          rows: [{
            x: 5,
            y: 5,
            status: ZoneStatus.UNCONTESTED,
            human_cp: 4,
            zombie_cp: 2,
            temp_uncontested_until: null,
            updated_at: new Date()
          }]
        });

      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: { query: mockQuery }
      });

      // Mock control points calculation
      const mockPlayerService = require('../models/player').PlayerService;
      mockPlayerService.prototype.getPlayersByCoordinates = jest.fn().mockResolvedValue([
        { id: '1' }, { id: '2' }
      ]); // 2 players = 4 CP

      const mockZombieService = require('../services/zombieService').ZombieService;
      mockZombieService.getInstance = jest.fn().mockReturnValue({
        getZombiesAtLocation: jest.fn().mockResolvedValue({ count: 2 }) // 2 zombies = 2 CP
      });

      const contest = await zoneContestService.getZoneContest(5, 5);
      
      expect(contest.status).toBe(ZoneStatus.UNCONTESTED);
      expect(contest.humanCp).toBe(4);
      expect(contest.zombieCp).toBe(2);
    });

    test('should create contested zone when zombies have more CP', async () => {
      // Mock database for both SELECT (no existing contest) and INSERT operations
      const mockDb = require('../services/database').DatabaseService;
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // No existing contest
        .mockResolvedValueOnce({ // Insert new contest
          rows: [{
            x: 5,
            y: 5,
            status: ZoneStatus.CONTESTED,
            human_cp: 2,
            zombie_cp: 5,
            temp_uncontested_until: null,
            updated_at: new Date()
          }]
        });

      mockDb.getInstance = jest.fn().mockReturnValue({
        pool: { query: mockQuery }
      });

      // Mock control points calculation
      const mockPlayerService = require('../models/player').PlayerService;
      mockPlayerService.prototype.getPlayersByCoordinates = jest.fn().mockResolvedValue([
        { id: '1' }
      ]); // 1 player = 2 CP

      const mockZombieService = require('../services/zombieService').ZombieService;
      mockZombieService.getInstance = jest.fn().mockReturnValue({
        getZombiesAtLocation: jest.fn().mockResolvedValue({ count: 5 }) // 5 zombies = 5 CP
      });

      const contest = await zoneContestService.getZoneContest(5, 5);
      
      expect(contest.status).toBe(ZoneStatus.CONTESTED);
      expect(contest.humanCp).toBe(2);
      expect(contest.zombieCp).toBe(5);
    });
  });
});