import { GameState, GamePhase, Player, City, Location, PlayerStatus, PlayerCondition } from '../types/game';
import { PlayerService } from '../models/player';
import { CityService } from '../models/city';
import { ItemService } from '../models/item';
import { DatabaseService } from '../services/database';
import { ZombieService } from '../services/zombieService';
import { ZoneContestService } from '../services/zoneContest';
import { Client, EmbedBuilder } from 'discord.js';
import cron from 'node-cron';

interface AttackResult {
  playerName: string;
  discordId: string;
  attacksReceived: number;
  previousStatus: PlayerStatus;
  newStatus: PlayerStatus;
  location: Location;
}

interface HordeAttackReport {
  day: number;
  hordeSize: number;
  cityDefense: number;
  townBreached: boolean;
  zombiesBreached: number;
  playersKilledOutside: AttackResult[];
  playersInTown: AttackResult[];
  totalAttacks: number;
}

export class GameEngine {
  private static instance: GameEngine;
  private playerService: PlayerService;
  private cityService: CityService;
  private itemService: ItemService;
  private zombieService: ZombieService;
  private zoneContestService: ZoneContestService;
  private db: DatabaseService;
  private gameState: GameState | null = null;
  private discordClient: Client | null = null;

  private constructor() {
    this.playerService = new PlayerService();
    this.cityService = new CityService();
    this.itemService = new ItemService();
    this.zombieService = ZombieService.getInstance();
    this.zoneContestService = ZoneContestService.getInstance();
    this.db = DatabaseService.getInstance();
    this.initializeGameEngine();
  }

  public static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  public setDiscordClient(client: Client): void {
    this.discordClient = client;
  }

  private async initializeGameEngine(): Promise<void> {
    try {
      // Initialize default items
      await this.itemService.initializeDefaultItems();
      
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

    // Schedule zone contest timer processing every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.processZoneContestTimers();
    });

    console.log(`⏰ Phase transition cron jobs scheduled: Game Mode at ${gameStartTime}, Horde Mode at ${hordeStartTime}`);
    console.log(`⏰ Zone contest timer processing scheduled every 5 minutes`);
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
      
      // Calculate defense from buildings (same logic as in town.ts)
      const buildingCounts = {
        watchtower: 0,
        wall: 0,
        workshop: 0,
        well: 0,
        hospital: 0
      };

      city.buildings.forEach(building => {
        if (buildingCounts.hasOwnProperty(building.type)) {
          buildingCounts[building.type as keyof typeof buildingCounts]++;
        }
      });

      const cityDefense = buildingCounts.watchtower * 2 + buildingCounts.wall * 1;

      console.log(`⚔️ Horde Attack - Day ${this.gameState!.currentDay}`);
      console.log(`🧟‍♂️ Horde Size: ${hordeSize}, City Defense: ${cityDefense}`);

      // Initialize attack report
      const attackReport: HordeAttackReport = {
        day: this.gameState!.currentDay,
        hordeSize,
        cityDefense,
        townBreached: cityDefense < hordeSize,
        zombiesBreached: Math.max(0, hordeSize - cityDefense),
        playersKilledOutside: [],
        playersInTown: [],
        totalAttacks: 0
      };

      // First: Kill all players outside the town during horde event
      const playersWaste = await this.playerService.getPlayersByLocation(Location.WASTE);
      const playersGreaterWaste = await this.playerService.getPlayersByLocation(Location.GREATER_WASTE);
      const playersAtGate = await this.playerService.getPlayersByLocation(Location.GATE);
      const playersOutsideTown = [...playersWaste, ...playersGreaterWaste, ...playersAtGate];

      for (const player of playersOutsideTown) {
        const previousStatus = player.status;
        await this.playerService.updatePlayerStatus(player.discordId, PlayerStatus.DEAD);
        
        attackReport.playersKilledOutside.push({
          playerName: player.name,
          discordId: player.discordId,
          attacksReceived: 0, // They're killed automatically for being outside
          previousStatus,
          newStatus: PlayerStatus.DEAD,
          location: player.location
        });
        
        console.log(`💀 ${player.name} was killed for being outside the town during the horde attack`);
      }

      // Second: Handle breach attacks on players in town
      if (attackReport.townBreached && attackReport.zombiesBreached > 0) {
        console.log(`💥 Town defenses breached! ${attackReport.zombiesBreached} zombies made it into the town.`);
        
        // Get all players in town (city and home locations)
        const playersInCity = await this.playerService.getPlayersByLocation(Location.CITY);
        const playersInHome = await this.playerService.getPlayersByLocation(Location.HOME);
        const playersInTown = [...playersInCity, ...playersInHome];

        if (playersInTown.length > 0) {
          // Each zombie that breached makes one attack attempt
          attackReport.totalAttacks = attackReport.zombiesBreached;
          
          // Initialize attack tracking for all players in town
          const playerAttacks: Map<string, number> = new Map();
          for (const player of playersInTown) {
            playerAttacks.set(player.discordId, 0);
            attackReport.playersInTown.push({
              playerName: player.name,
              discordId: player.discordId,
              attacksReceived: 0,
              previousStatus: player.status,
              newStatus: player.status,
              location: player.location
            });
          }

          // Distribute zombie attacks randomly
          for (let i = 0; i < attackReport.zombiesBreached; i++) {
            const randomPlayer = playersInTown[Math.floor(Math.random() * playersInTown.length)];
            const currentAttacks = playerAttacks.get(randomPlayer.discordId) || 0;
            playerAttacks.set(randomPlayer.discordId, currentAttacks + 1);
          }

          // Process attacks with 50% hit chance
          for (const [playerId, attackCount] of playerAttacks) {
            const player = playersInTown.find(p => p.discordId === playerId)!;
            const playerReportEntry = attackReport.playersInTown.find(p => p.discordId === playerId)!;
            playerReportEntry.attacksReceived = attackCount;
            
            let successfulHits = 0;
            let currentStatus = player.status;
            let hasHealthy = player.conditions.includes(PlayerCondition.HEALTHY);
            let hasWounded = player.conditions.includes(PlayerCondition.WOUNDED);
            
            // Each attack has 50% chance to hit
            for (let attack = 0; attack < attackCount; attack++) {
              if (Math.random() < 0.5) { // 50% chance
                successfulHits++;
                
                if (hasHealthy && !hasWounded) {
                  // Healthy -> Wounded
                  await this.playerService.removePlayerCondition(player.discordId, PlayerCondition.HEALTHY);
                  await this.playerService.addPlayerCondition(player.discordId, PlayerCondition.WOUNDED);
                  hasHealthy = false;
                  hasWounded = true;
                  console.log(`🩸 ${player.name} was wounded by a zombie attack (${successfulHits}/${attackCount} hits)`);
                } else if (hasWounded) {
                  // Wounded -> Dead
                  await this.playerService.removePlayerCondition(player.discordId, PlayerCondition.WOUNDED);
                  currentStatus = PlayerStatus.DEAD;
                  await this.playerService.updatePlayerStatus(player.discordId, currentStatus);
                  console.log(`💀 ${player.name} was killed by a zombie attack (${successfulHits}/${attackCount} hits)`);
                  break; // No point in continuing attacks on a dead player
                }
              }
            }
            
            playerReportEntry.newStatus = currentStatus;
            
            if (successfulHits > 0) {
              console.log(`⚔️ ${player.name} received ${attackCount} attacks, ${successfulHits} hit (${player.status} → ${currentStatus})`);
            } else if (attackCount > 0) {
              console.log(`🛡️ ${player.name} evaded all ${attackCount} zombie attacks`);
            }
          }
        } else {
          console.log('🏙️ No players in town to attack.');
        }
      } else {
        console.log('🛡️ Town defenses hold! No zombies breached the defenses.');
      }

      // Generate and send attack report
      await this.sendAttackReport(attackReport);
      
      // Update city population
      await this.cityService.updateCityPopulation(city.id);
      
      // Process zombie spread after horde attack
      await this.zombieService.processHordeSpread();
      
    } catch (error) {
      console.error('Error processing horde attack:', error);
    }
  }

  private async sendAttackReport(report: HordeAttackReport): Promise<void> {
    try {
      // Log to console for debugging
      console.log('\n🧟‍♂️ HORDE ATTACK REPORT 🧟‍♂️');
      console.log(`📅 Day ${report.day}`);
      console.log(`🛡️ Town Defense: ${report.cityDefense}`);
      console.log(`🧟‍♂️ Horde Size: ${report.hordeSize}`);
      
      // Create Discord embed for attack report
      const embed = new EmbedBuilder()
        .setColor(report.townBreached ? '#ff6b6b' : '#4ecdc4')
        .setTitle('🧟‍♂️ HORDE ATTACK REPORT 🧟‍♂️')
        .setDescription(`**Day ${report.day} Results**`)
        .addFields([
          { 
            name: '🛡️ Town Defense', 
            value: `${report.cityDefense}`, 
            inline: true 
          },
          { 
            name: '🧟‍♂️ Horde Size', 
            value: `${report.hordeSize}`, 
            inline: true 
          }
        ])
        .setTimestamp();

      // Town breach information
      if (report.townBreached) {
        embed.addFields([
          { 
            name: '💥 TOWN BREACHED!', 
            value: `${report.zombiesBreached} zombies entered the town.\n⚔️ Total zombie attacks made: ${report.totalAttacks}`, 
            inline: false 
          }
        ]);

        // Players in town results
        if (report.playersInTown.length > 0) {
          const townResults = [];
          for (const playerResult of report.playersInTown) {
            const statusChange = playerResult.previousStatus !== playerResult.newStatus 
              ? ` (${playerResult.previousStatus} → ${playerResult.newStatus})`
              : '';
            
            if (playerResult.attacksReceived > 0) {
              townResults.push(`${playerResult.playerName}: ${playerResult.attacksReceived} attacks${statusChange}`);
            } else {
              townResults.push(`${playerResult.playerName}: No attacks received`);
            }
          }
          
          embed.addFields([
            { 
              name: '🏙️ PLAYERS IN TOWN', 
              value: townResults.join('\n'), 
              inline: false 
            }
          ]);
        }
      } else {
        embed.addFields([
          { 
            name: '🛡️ Defense Success', 
            value: 'Town defenses held strong - no zombies breached.', 
            inline: false 
          }
        ]);
      }
      
      // Players killed outside
      if (report.playersKilledOutside.length > 0) {
        const outsideDeaths = [];
        for (const playerResult of report.playersKilledOutside) {
          const locationName = playerResult.location === Location.WASTE ? 'Waste' : 
                              playerResult.location === Location.GREATER_WASTE ? 'Greater Waste' :
                              playerResult.location === Location.GATE ? 'Gate' : 'Outside Area';
          outsideDeaths.push(`${playerResult.playerName} (was in ${locationName})`);
        }
        
        embed.addFields([
          { 
            name: '💀 PLAYERS KILLED OUTSIDE TOWN', 
            value: outsideDeaths.join('\n'), 
            inline: false 
          }
        ]);
      }
      
      // Summary - Note: This will need to be updated to properly track condition changes
      const totalWounded = 0; // Temporarily disabled - needs condition tracking logic
      const totalKilled = [...report.playersInTown, ...report.playersKilledOutside].filter(p => p.newStatus === PlayerStatus.DEAD).length;
      
      embed.addFields([
        { 
          name: '📊 SUMMARY', 
          value: `🩸 Players wounded: ${totalWounded}\n💀 Players killed: ${totalKilled}`, 
          inline: false 
        }
      ]);

      // Send to Discord channel if client and channel are available
      if (this.discordClient && process.env.DISCORD_ATTACK_REPORT_CHANNEL_ID) {
        try {
          const channel = await this.discordClient.channels.fetch(process.env.DISCORD_ATTACK_REPORT_CHANNEL_ID);
          if (channel && channel.isTextBased() && 'send' in channel) {
            await channel.send({ embeds: [embed] });
            console.log('✅ Attack report sent to Discord channel');
          } else {
            console.log('⚠️ Discord channel not found or not text-based');
          }
        } catch (discordError) {
          console.error('❌ Failed to send attack report to Discord:', discordError);
        }
      } else {
        console.log('⚠️ Discord client or channel ID not configured, skipping Discord message');
      }
      
      console.log('🧟‍♂️ Attack report complete.\n');
      
    } catch (error) {
      console.error('Error sending attack report:', error);
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
        return { canAct: false, reason: 'You are dead!' };
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
      
      // Apply horde scaling just like in the automatic transition
      if (this.gameState) {
        // Scale horde size for next attack with randomness
        const scalingFactor = parseFloat(process.env.HORDE_SCALING_FACTOR || '1.2');
        const randomness = parseFloat(process.env.HORDE_SCALING_RANDOMNESS || '0.3');
        const randomMultiplier = 1 + (Math.random() - 0.5) * randomness;
        const newHordeSize = Math.floor(this.gameState.hordeSize * scalingFactor * randomMultiplier);
        
        // Advance the day by 1 and apply scaling
        this.gameState.currentDay += 1;
        this.gameState.hordeSize = newHordeSize;
        
        await this.db.redis.set('game_state', JSON.stringify(this.gameState));
        console.log(`📅 Day advanced to ${this.gameState.currentDay}, Horde size scaled to ${newHordeSize}`);
      }
      
      console.log('✅ Horde attack results processed with scaling');
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

  private async processZoneContestTimers(): Promise<void> {
    try {
      await this.zoneContestService.processExpiredTemporaryZones();
    } catch (error) {
      console.error('Error processing zone contest timers:', error);
    }
  }
}