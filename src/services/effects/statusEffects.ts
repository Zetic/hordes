import { ItemEffect, ItemUseContext, ItemUseResult } from '../../types/itemEffects';
import { PlayerService } from '../../models/player';
import { PlayerStatus, isVitalStatus, isTemporaryCondition, isWoundType } from '../../types/game';

const playerService = new PlayerService();

export async function handleRestoreAPEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  try {
    const apToRestore = effect.value || 0;
    
    // Check if player has dehydrated condition - special case for Water Ration
    if (context.player.conditions && context.player.conditions.includes(PlayerStatus.DEHYDRATED)) {
      // For dehydrated players using water ration: 0 AP, remove dehydrated and add thirsty
      await playerService.removePlayerCondition(context.player.discordId, PlayerStatus.DEHYDRATED);
      await playerService.addPlayerCondition(context.player.discordId, PlayerStatus.THIRSTY);
      
      return {
        success: true,
        message: `💧 You drink the water, feeling slightly better. Your dehydration becomes thirst.`,
        effectData: { apRestored: 0, statusChanged: true }
      };
    }
    
    // Normal case - restore AP
    const currentAP = context.player.actionPoints;
    const maxAP = context.player.maxActionPoints;
    const newAP = Math.min(currentAP + apToRestore, maxAP);
    const actualRestored = newAP - currentAP;
    
    if (actualRestored > 0) {
      await playerService.updatePlayerActionPoints(context.player.discordId, newAP);
    }
    
    return {
      success: true,
      message: `⚡ You restore ${actualRestored} action point${actualRestored !== 1 ? 's' : ''}.`,
      effectData: { apRestored: actualRestored }
    };
  } catch (error) {
    console.error('Error restoring AP:', error);
    return {
      success: false,
      message: '❌ Failed to restore action points.'
    };
  }
}

export async function handleAddStatusEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  try {
    const statusToAdd = effect.status as PlayerStatus;
    
    // Special handling for HEALED status - prevent bandage use if already healed
    if (statusToAdd === PlayerStatus.HEALED) {
      if (context.player.conditions && context.player.conditions.includes(PlayerStatus.HEALED)) {
        return {
          success: false,
          message: '🩹 You are already healed and cannot use another bandage.',
          effectData: { statusAdded: false }
        };
      }
      
      // Check if player actually has a wound to heal
      const hasWound = isWoundType(context.player.status) || 
                       (context.player.conditions && context.player.conditions.some((condition: PlayerStatus) => isWoundType(condition)));
      
      if (!hasWound) {
        return {
          success: false,
          message: '🩹 You have no wounds to heal.',
          effectData: { statusAdded: false }
        };
      }
    }
    
    // Check if this is a vital status or temporary condition
    if (isVitalStatus(statusToAdd)) {
      // Handle vital status change
      if (context.player.status === statusToAdd) {
        return {
          success: true,
          message: `You already have the ${statusToAdd} status.`,
          effectData: { statusAdded: false }
        };
      }
      
      // Update vital status
      await playerService.updatePlayerStatus(context.player.discordId, statusToAdd);
    } else if (isTemporaryCondition(statusToAdd)) {
      // Handle temporary condition - can have multiple
      if (context.player.conditions && context.player.conditions.includes(statusToAdd)) {
        return {
          success: true,
          message: `You already have the ${statusToAdd} condition.`,
          effectData: { statusAdded: false }
        };
      }
      
      // Add the condition
      await playerService.addPlayerCondition(context.player.discordId, statusToAdd);
    }
    
    const statusMessages: { [key: string]: string } = {
      [PlayerStatus.REFRESHED]: '💧 You feel refreshed and hydrated!',
      [PlayerStatus.FED]: '🍞 You feel well-fed and satisfied!',
      [PlayerStatus.THIRSTY]: '🫗 You feel thirsty.',
      [PlayerStatus.DEHYDRATED]: '🏜️ You feel severely dehydrated.',
      [PlayerStatus.EXHAUSTED]: '😴 You feel exhausted.',
      [PlayerStatus.HEALED]: '🩹 You feel healed and restored!',
      [PlayerStatus.INFECTED]: '🦠 You feel infected and unwell.'
    };
    
    return {
      success: true,
      message: statusMessages[statusToAdd] || `You gained the ${statusToAdd} status.`,
      effectData: { statusAdded: true, newStatus: statusToAdd }
    };
  } catch (error) {
    console.error('Error adding status:', error);
    return {
      success: false,
      message: '❌ Failed to apply status effect.'
    };
  }
}

export async function handleRemoveStatusEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  try {
    const statusToRemove = effect.status as PlayerStatus;
    
    // Check if this is a wound type (now handled as conditions)
    if (isWoundType(statusToRemove)) {
      // Handle wound removal - check both status and conditions
      const hasWoundAsStatus = context.player.status === statusToRemove;
      const hasWoundAsCondition = context.player.conditions && context.player.conditions.includes(statusToRemove);
      
      if (!hasWoundAsStatus && !hasWoundAsCondition) {
        // Silent success if wound isn't present
        return {
          success: true,
          message: '',
          effectData: { statusRemoved: false }
        };
      }
      
      // Remove wound from status if present
      if (hasWoundAsStatus) {
        // When removing a wound status, player becomes alive
        await playerService.updatePlayerStatus(context.player.discordId, PlayerStatus.ALIVE);
      }
      
      // Remove wound from conditions if present
      if (hasWoundAsCondition) {
        await playerService.removePlayerCondition(context.player.discordId, statusToRemove);
      }
      
      return {
        success: true,
        message: `🩹 Wound treated successfully.`,
        effectData: { statusRemoved: true, removedStatus: statusToRemove }
      };
    } else if (isVitalStatus(statusToRemove)) {
      // Handle vital status removal/change (DEAD)
      if (context.player.status !== statusToRemove) {
        // Silent success if status isn't present
        return {
          success: true,
          message: '',
          effectData: { statusRemoved: false }
        };
      }
      
      if (statusToRemove === PlayerStatus.DEAD) {
        // Revival case - player becomes alive
        await playerService.updatePlayerStatus(context.player.discordId, PlayerStatus.ALIVE);
      }
      
      return {
        success: true,
        message: `${statusToRemove} status removed.`,
        effectData: { statusRemoved: true, removedStatus: statusToRemove }
      };
    } else if (isTemporaryCondition(statusToRemove)) {
      // Handle temporary condition removal
      if (!context.player.conditions || !context.player.conditions.includes(statusToRemove)) {
        // Silent success if condition isn't present
        return {
          success: true,
          message: '',
          effectData: { statusRemoved: false }
        };
      }
      
      // Remove the condition
      await playerService.removePlayerCondition(context.player.discordId, statusToRemove);
      
      const statusMessages: { [key: string]: string } = {
        [PlayerStatus.THIRSTY]: '💧 Your thirst is quenched.',
        [PlayerStatus.DEHYDRATED]: '💧 You are no longer dehydrated.',
        [PlayerStatus.EXHAUSTED]: '⚡ You feel more energetic.',
        [PlayerStatus.FED]: '🍞 You are no longer full.',
        [PlayerStatus.REFRESHED]: '💧 The refreshing effect wears off.',
        [PlayerStatus.HEALED]: '🩹 The healing effect wears off.',
        [PlayerStatus.INFECTED]: '🦠 The infection clears up.'
      };
      
      return {
        success: true,
        message: statusMessages[statusToRemove] || `${statusToRemove} condition removed.`,
        effectData: { statusRemoved: true, removedStatus: statusToRemove }
      };
    }
    
    // Fallback
    return {
      success: false,
      message: '❌ Unable to remove status effect.'
    };
  } catch (error) {
    console.error('Error removing status:', error);
    return {
      success: false,
      message: '❌ Failed to remove status effect.'
    };
  }
}