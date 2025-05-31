import { ItemEffect, ItemUseContext, ItemUseResult } from '../../types/itemEffects';
import { ZombieService } from '../zombieService';

export async function handleKillZombieEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  const zombieService = ZombieService.getInstance();
  
  try {
    // Check if player has valid coordinates
    if (context.location.x === null || context.location.x === undefined || 
        context.location.y === null || context.location.y === undefined) {
      return {
        success: false,
        message: 'Invalid position. Cannot use item here.'
      };
    }

    // Get zombies at current location
    const zombies = await zombieService.getZombiesAtLocation(context.location.x, context.location.y);
    if (!zombies || zombies.count <= 0) {
      return {
        success: false,
        message: 'There are no zombies here to attack.'
      };
    }

    // Roll for kill chance
    const killChance = effect.chance || 0;
    const killRoll = Math.random() * 100;
    const killSuccess = killRoll <= killChance;

    // Roll for break chance
    const breakChance = effect.breakChance || 0;
    const breakRoll = Math.random() * 100;
    const itemBreaks = breakRoll <= breakChance;

    let message = '';
    
    if (killSuccess) {
      // Kill zombies based on effect value (default 1)
      const zombiesToKill = effect.value || 1;
      await zombieService.removeZombiesAtLocation(context.location.x, context.location.y, zombiesToKill);
      message += `Successfully killed ${zombiesToKill} zombie${zombiesToKill > 1 ? 's' : ''}!`;
    } else {
      message += 'Your attack missed the zombie.';
    }

    let transformedInto: string | undefined;
    if (itemBreaks && effect.transformInto) {
      transformedInto = effect.transformInto;
      message += ` Your item broke and transformed into ${effect.transformInto}.`;
    } else if (itemBreaks) {
      message += ' Your item broke!';
    } else {
      message += ' Your item survived the attack.';
    }

    return {
      success: killSuccess,
      message,
      itemBroken: itemBreaks,
      transformedInto,
      effectData: {
        zombiesKilled: killSuccess ? (effect.value || 1) : 0,
        originalZombieCount: zombies.count
      }
    };

  } catch (error) {
    console.error('Error executing kill zombie effect:', error);
    return {
      success: false,
      message: 'An error occurred while trying to kill zombies.'
    };
  }
}