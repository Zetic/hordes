import { GameState, GamePhase, Player, City } from '../types/game';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { DatabaseService } from '../services/database';
import cron from 'node-cron';

export class GameEngine {
  private static instance: GameEngine;
  private playerService: PlayerService;
  private cityService: CityService;
  private db: DatabaseService;
  private gameState: GameState | null = null;

  private constructor() {
    this.playerService = new PlayerService();
    this.cityService = new CityService();
    this.db = DatabaseService.getInstance();
    this.initializeGameEngine();
  }

  public static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  private async initializeGameEngine(): Promise<void> {
    try {
      // Load or create game state
      await this.loadGameState();
      
      // Schedule game phase transitions
      this.schedulePhaseTransitions();
      
      console.log('🎮 Game Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize game engine:', error);
    }
  }

  private async loadGameState(): Promise<void> {
    try {
      // Get default city
      const city = await this.cityService.getDefaultCity();
      if (!city) {
        throw new Error('No city found');
      }

      this.gameState = {
        cityId: city.id,
        currentDay: city.day,
        currentPhase: city.gamePhase,
        lastHordeAttack: new Date(),
        nextPhaseChange: this.calculateNextPhaseChange(city.gamePhase)
      };

      // Store in Redis for quick access
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
    } catch (error) {
      console.error('Error loading game state:', error);
    }
  }

  private schedulePhaseTransitions(): void {
    const gameStartTime = process.env.GAME_START_TIME || '21:00';
    const hordeStartTime = process.env.HORDE_START_TIME || '20:00';
    
    const [gameHour, gameMinute] = gameStartTime.split(':').map(Number);
    const [hordeHour, hordeMinute] = hordeStartTime.split(':').map(Number);

    // Schedule Play Mode start
    cron.schedule(`${gameMinute} ${gameHour} * * *`, async () => {
      await this.transitionToPlayMode();
    });

    // Schedule Horde Mode start
    cron.schedule(`${hordeMinute} ${hordeHour} * * *`, async () => {
      await this.transitionToHordeMode();
    });

    console.log(`⏰ Phase transition cron jobs scheduled: Game Mode at ${gameStartTime}, Horde Mode at ${hordeStartTime}`);
  }

  private async transitionToPlayMode(): Promise<void> {
    try {
      if (!this.gameState) return;

      console.log('🌅 Transitioning to Play Mode...');
      
      // Update city phase
      await this.cityService.updateGamePhase(this.gameState.cityId, GamePhase.PLAY_MODE);
      
      // Reset daily action points for all players
      await this.playerService.resetDailyActionPoints();
      
      // Advance day
      await this.cityService.advanceDay(this.gameState.cityId);
      
      // Update game state
      this.gameState.currentPhase = GamePhase.PLAY_MODE;
      this.gameState.currentDay += 1;
      this.gameState.nextPhaseChange = this.calculateNextPhaseChange(GamePhase.PLAY_MODE);
      
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
      
      console.log(`🎮 Day ${this.gameState.currentDay} - Play Mode started`);
    } catch (error) {
      console.error('Error transitioning to play mode:', error);
    }
  }

  private async transitionToHordeMode(): Promise<void> {
    try {
      if (!this.gameState) return;

      console.log('🧟‍♂️ Transitioning to Horde Mode...');
      
      // Update city phase
      await this.cityService.updateGamePhase(this.gameState.cityId, GamePhase.HORDE_MODE);
      
      // Process horde attack
      await this.processHordeAttack();
      
      // Update game state
      this.gameState.currentPhase = GamePhase.HORDE_MODE;
      this.gameState.lastHordeAttack = new Date();
      this.gameState.nextPhaseChange = this.calculateNextPhaseChange(GamePhase.HORDE_MODE);
      
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
      
      console.log('🧟‍♂️ Horde attack completed');
    } catch (error) {
      console.error('Error transitioning to horde mode:', error);
    }
  }

  private async processHordeAttack(): Promise<void> {
    try {
      // Get current city and alive players
      const city = await this.cityService.getCity(this.gameState!.cityId);
      const players = await this.playerService.getAlivePlayers();
      
      if (!city || players.length === 0) return;

      // Calculate attack intensity based on day
      const attackIntensity = Math.min(this.gameState!.currentDay * 0.1, 0.8);
      
      // Process casualties based on city defenses and attack intensity
      const casualties = Math.floor(players.length * attackIntensity * (1 - city.defenseLevel * 0.1));
      
      console.log(`⚔️ Horde attack: ${casualties} casualties out of ${players.length} players`);
      
      // Apply damage to random players
      for (let i = 0; i < casualties && i < players.length; i++) {
        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        const damage = Math.floor(Math.random() * 30) + 20; // 20-50 damage
        const newHealth = Math.max(0, randomPlayer.health - damage);
        
        await this.playerService.updatePlayerHealth(randomPlayer.discordId, newHealth);
        
        if (newHealth === 0) {
          console.log(`💀 ${randomPlayer.name} was killed in the horde attack`);
        }
      }
      
      // Update city population
      await this.cityService.updateCityPopulation(city.id);
      
    } catch (error) {
      console.error('Error processing horde attack:', error);
    }
  }

  private calculateNextPhaseChange(currentPhase: GamePhase): Date {
    const now = new Date();
    const nextChange = new Date();
    
    const gameStartTime = process.env.GAME_START_TIME || '21:00';
    const hordeStartTime = process.env.HORDE_START_TIME || '20:00';
    
    const [gameHour, gameMinute] = gameStartTime.split(':').map(Number);
    const [hordeHour, hordeMinute] = hordeStartTime.split(':').map(Number);
    
    if (currentPhase === GamePhase.PLAY_MODE) {
      // Next change is Horde Mode
      nextChange.setHours(hordeHour, hordeMinute, 0, 0);
      if (nextChange <= now) {
        nextChange.setDate(nextChange.getDate() + 1);
      }
    } else {
      // Next change is Play Mode
      nextChange.setHours(gameHour, gameMinute, 0, 0);
      if (nextChange <= now) {
        nextChange.setDate(nextChange.getDate() + 1);
      }
    }
    
    return nextChange;
  }

  public async getCurrentGameState(): Promise<GameState | null> {
    try {
      if (this.gameState) {
        return this.gameState;
      }
      
      // Try to load from Redis
      const cached = await this.db.redis.get('game_state');
      if (cached) {
        this.gameState = JSON.parse(cached);
        return this.gameState;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting game state:', error);
      return null;
    }
  }

  public async canPerformAction(discordId: string): Promise<{ canAct: boolean, reason?: string }> {
    try {
      const gameState = await this.getCurrentGameState();
      if (!gameState) {
        return { canAct: false, reason: 'Game not initialized' };
      }

      if (gameState.currentPhase === GamePhase.HORDE_MODE) {
        return { canAct: false, reason: 'Cannot act during Horde Mode (8:00-9:00 PM)' };
      }

      const player = await this.playerService.getPlayer(discordId);
      if (!player) {
        return { canAct: false, reason: 'Player not found' };
      }

      if (!player.isAlive) {
        return { canAct: false, reason: 'Player is dead' };
      }

      if (player.actionPoints <= 0) {
        return { canAct: false, reason: 'No action points remaining' };
      }

      return { canAct: true };
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { canAct: false, reason: 'Error checking permissions' };
    }
  }

  // Admin methods for testing purposes
  public async resetTown(): Promise<boolean> {
    try {
      if (!this.gameState) {
        console.error('Game state not initialized');
        return false;
      }

      // Reset all players to default state
      await this.playerService.resetAllPlayers();
      
      // Reset city to default state
      await this.cityService.resetCity(this.gameState.cityId);
      
      // Reset game state to day 1, play mode
      this.gameState.currentDay = 1;
      this.gameState.currentPhase = GamePhase.PLAY_MODE;
      this.gameState.lastHordeAttack = new Date();
      this.gameState.nextPhaseChange = this.calculateNextPhaseChange(GamePhase.PLAY_MODE);
      
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
      
      console.log('🔄 Town has been reset to initial state');
      return true;
    } catch (error) {
      console.error('Error resetting town:', error);
      return false;
    }
  }

  public async triggerHordeResults(): Promise<boolean> {
    try {
      console.log('🧟‍♂️ Manually triggering horde attack results...');
      await this.processHordeAttack();
      console.log('✅ Horde attack results processed');
      return true;
    } catch (error) {
      console.error('Error triggering horde results:', error);
      return false;
    }
  }

  public async refreshPlayerActionPoints(discordId: string): Promise<boolean> {
    try {
      const success = await this.playerService.resetPlayerActionPoints(discordId);
      if (success) {
        console.log(`⚡ Action points refreshed for player ${discordId}`);
      }
      return success;
    } catch (error) {
      console.error('Error refreshing player action points:', error);
      return false;
    }
  }
}