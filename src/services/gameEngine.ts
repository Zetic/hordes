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

      // Get existing horde size from Redis or initialize
      const existingState = await this.db.redis.get('game_state');
      let hordeSize = parseInt(process.env.INITIAL_HORDE_SIZE || '10');
      
      if (existingState) {
        const parsed = JSON.parse(existingState);
        hordeSize = parsed.hordeSize || hordeSize;
      }

      this.gameState = {
        cityId: city.id,
        currentDay: city.day,
        currentPhase: city.gamePhase,
        lastHordeAttack: new Date(),
        nextPhaseChange: this.calculateNextPhaseChange(city.gamePhase),
        hordeSize: hordeSize
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
      
      // Reset daily action points for alive players only
      await this.playerService.resetDailyActionPoints();
      
      // Advance day
      await this.cityService.advanceDay(this.gameState.cityId);
      
      // Scale horde size for next attack with randomness
      const scalingFactor = parseFloat(process.env.HORDE_SCALING_FACTOR || '1.2');
      const randomness = parseFloat(process.env.HORDE_SCALING_RANDOMNESS || '0.3');
      const randomMultiplier = 1 + (Math.random() - 0.5) * randomness;
      const newHordeSize = Math.floor(this.gameState.hordeSize * scalingFactor * randomMultiplier);
      
      // Update game state
      this.gameState.currentPhase = GamePhase.PLAY_MODE;
      this.gameState.currentDay += 1;
      this.gameState.hordeSize = newHordeSize;
      this.gameState.nextPhaseChange = this.calculateNextPhaseChange(GamePhase.PLAY_MODE);
      
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
      
      console.log(`🎮 Day ${this.gameState.currentDay} - Play Mode started. Horde size: ${newHordeSize}`);
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
      // Get current city and all players
      const city = await this.cityService.getCity(this.gameState!.cityId);
      const alivePlayers = await this.playerService.getAlivePlayers();
      
      if (!city || alivePlayers.length === 0) {
        console.log('🧟‍♂️ No city or no alive players - skipping horde attack');
        return;
      }

      const hordeSize = this.gameState!.hordeSize;
      const cityDefense = city.defenseLevel;

      console.log(`⚔️ Horde Attack - Day ${this.gameState!.currentDay}`);
      console.log(`🧟‍♂️ Horde Size: ${hordeSize}, City Defense: ${cityDefense}`);

      // Determine if the town is breached (defense insufficient to hold back horde)
      const townBreached = cityDefense < hordeSize;

      if (townBreached) {
        console.log('💥 Town defenses breached! All players are in danger.');
        
        // Calculate casualties based on how badly the town was breached
        const breachSeverity = (hordeSize - cityDefense) / hordeSize;
        const maxCasualties = Math.floor(alivePlayers.length * 0.8); // Max 80% casualties
        const casualties = Math.floor(maxCasualties * breachSeverity);
        
        console.log(`⚔️ Breach severity: ${(breachSeverity * 100).toFixed(1)}% - ${casualties} casualties expected`);
        
        // Apply damage to random players regardless of location (town is breached)
        await this.applyHordeDamage(alivePlayers, casualties, 'All players are in danger - town defenses have been breached!');
      } else {
        console.log('🛡️ Town defenses hold! Only players outside the safety of the city are in danger.');
        
        // Only players outside the city are at risk
        const playersOutside = await this.playerService.getPlayersByLocation('outside' as any);
        const playersGreaterOutside = await this.playerService.getPlayersByLocation('greater_outside' as any);
        const vulnerablePlayers = [...playersOutside, ...playersGreaterOutside];
        
        if (vulnerablePlayers.length > 0) {
          // Calculate casualties based on horde size vs vulnerable players
          const casualtyRate = Math.min(hordeSize / 20, 0.6); // Max 60% of outside players
          const casualties = Math.floor(vulnerablePlayers.length * casualtyRate);
          
          console.log(`⚔️ ${vulnerablePlayers.length} players outside city safety - ${casualties} casualties expected`);
          
          await this.applyHordeDamage(vulnerablePlayers, casualties, 'Players outside the city were caught by the horde!');
        } else {
          console.log('✅ All players are safe within the city walls.');
        }
      }
      
      // Update city population
      await this.cityService.updateCityPopulation(city.id);
      
    } catch (error) {
      console.error('Error processing horde attack:', error);
    }
  }

  private async applyHordeDamage(targetPlayers: any[], casualties: number, reason: string): Promise<void> {
    console.log(`💀 Applying horde damage: ${reason}`);
    
    // Shuffle players to randomize damage
    const shuffledPlayers = [...targetPlayers].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < casualties && i < shuffledPlayers.length; i++) {
      const player = shuffledPlayers[i];
      const damage = Math.floor(Math.random() * 40) + 30; // 30-70 damage
      const newHealth = Math.max(0, player.health - damage);
      
      await this.playerService.updatePlayerHealth(player.discordId, newHealth);
      
      if (newHealth === 0) {
        console.log(`💀 ${player.name} was killed in the horde attack`);
      } else {
        console.log(`🩸 ${player.name} took ${damage} damage (${newHealth}/${player.maxHealth} health remaining)`);
      }
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
      
      // Reset game state to day 1, play mode, and initial horde size
      this.gameState.currentDay = 1;
      this.gameState.currentPhase = GamePhase.PLAY_MODE;
      this.gameState.lastHordeAttack = new Date();
      this.gameState.hordeSize = parseInt(process.env.INITIAL_HORDE_SIZE || '10');
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
      
      // Advance the day by 1 as requested
      if (this.gameState) {
        this.gameState.currentDay += 1;
        await this.db.redis.set('game_state', JSON.stringify(this.gameState));
        console.log(`📅 Day advanced to ${this.gameState.currentDay}`);
      }
      
      console.log('✅ Horde attack results processed');
      return true;
    } catch (error) {
      console.error('Error triggering horde results:', error);
      return false;
    }
  }

  public async setHordeSize(size: number): Promise<boolean> {
    try {
      if (!this.gameState) {
        console.error('Game state not initialized');
        return false;
      }

      this.gameState.hordeSize = Math.max(1, size); // Ensure horde size is at least 1
      await this.db.redis.set('game_state', JSON.stringify(this.gameState));
      
      console.log(`🧟‍♂️ Horde size set to ${this.gameState.hordeSize}`);
      return true;
    } catch (error) {
      console.error('Error setting horde size:', error);
      return false;
    }
  }

  public async revivePlayer(discordId: string): Promise<boolean> {
    try {
      const success = await this.playerService.revivePlayer(discordId);
      if (success) {
        console.log(`⚕️ Player ${discordId} has been revived`);
      }
      return success;
    } catch (error) {
      console.error('Error reviving player:', error);
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