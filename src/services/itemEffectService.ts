import { EffectType, ItemEffect, ItemUseContext, ItemUseResult } from '../types/itemEffects';
import { handleKillZombieEffect } from './effects/combatEffects';
import { handleHealPlayerEffect } from './effects/healingEffects';
import { handleRestoreAPEffect, handleAddStatusEffect, handleRemoveStatusEffect } from './effects/statusEffects';
import { getItemDefinition } from '../data/items';
import { PlayerCondition } from '../types/game';

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
    this.registerHandler(EffectType.RESTORE_AP, handleRestoreAPEffect);
    this.registerHandler(EffectType.ADD_STATUS, handleAddStatusEffect);
    this.registerHandler(EffectType.REMOVE_STATUS, handleRemoveStatusEffect);
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

  public canPlayerUseItem(itemName: string, playerConditions: PlayerCondition[]): { canUse: boolean; reason?: string } {
    const itemDef = getItemDefinition(itemName);
    if (!itemDef) {
      return { canUse: false, reason: 'Item not found' };
    }

    // Check condition interactions
    if (itemDef.subCategory === 'Hydration') {
      if (playerConditions.includes(PlayerCondition.REFRESHED)) {
        return { canUse: false, reason: 'You are already refreshed and cannot use hydration items.' };
      }
    }

    if (itemDef.subCategory === 'Nutrition') {
      if (playerConditions.includes(PlayerCondition.FED)) {
        return { canUse: false, reason: 'You are already fed and cannot use nutrition items.' };
      }
    }

    return { canUse: true };
  }
}