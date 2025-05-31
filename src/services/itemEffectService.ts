import { EffectType, ItemEffect, ItemUseContext, ItemUseResult } from '../types/itemEffects';
import { handleKillZombieEffect } from './effects/combatEffects';
import { handleHealPlayerEffect } from './effects/healingEffects';

export type EffectHandler = (effect: ItemEffect, context: ItemUseContext) => Promise<ItemUseResult>;

export class ItemEffectService {
  private static instance: ItemEffectService;
  private effectHandlers: Map<EffectType, EffectHandler>;

  private constructor() {
    this.effectHandlers = new Map();
    this.registerDefaultHandlers();
  }

  public static getInstance(): ItemEffectService {
    if (!ItemEffectService.instance) {
      ItemEffectService.instance = new ItemEffectService();
    }
    return ItemEffectService.instance;
  }

  private registerDefaultHandlers() {
    this.registerHandler(EffectType.KILL_ZOMBIE, handleKillZombieEffect);
    this.registerHandler(EffectType.HEAL_PLAYER, handleHealPlayerEffect);
    // Register more effects as they are implemented
  }

  public registerHandler(type: EffectType, handler: EffectHandler) {
    this.effectHandlers.set(type, handler);
  }

  public async executeEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
    const effectType = effect.type as EffectType;
    const handler = this.effectHandlers.get(effectType);
    
    if (!handler) {
      throw new Error(`No handler registered for effect type: ${effect.type}`);
    }
    
    return handler(effect, context);
  }

  public hasHandler(effectType: EffectType): boolean {
    return this.effectHandlers.has(effectType);
  }

  public getRegisteredEffects(): EffectType[] {
    return Array.from(this.effectHandlers.keys());
  }
}