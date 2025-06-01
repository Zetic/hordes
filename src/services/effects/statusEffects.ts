import { ItemEffect, ItemUseContext, ItemUseResult } from '../../types/itemEffects';
import { PlayerService } from '../../models/player';
import { PlayerStatus, PlayerCondition, isVitalStatus, isTemporaryCondition } from '../../types/game';

const playerService = new PlayerService();

export async function handleRestoreAPEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  try {
    const apToRestore = effect.value || 0;
    
    // Check if player has dehydrated condition - special case for Water Ration
    if (context.player.conditions && context.player.conditions.includes(PlayerCondition.DEHYDRATED)) {
      // For dehydrated players using water ration: 0 AP, remove dehydrated and add thirsty
      await playerService.removePlayerCondition(context.player.discordId, PlayerCondition.DEHYDRATED);
      await playerService.addPlayerCondition(context.player.discordId, PlayerCondition.THIRSTY);
      
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
    const statusToAdd = effect.status as PlayerCondition;
    
    // Check if this is a vital status or temporary condition
    if (isVitalStatus(statusToAdd)) {
      // Handle vital status change (HEALTHY/WOUNDED)
      if (context.player.conditions && context.player.conditions.includes(statusToAdd)) {
        return {
          success: true,
          message: `You already have the ${statusToAdd} condition.`,
          effectData: { statusAdded: false }
        };
      }
      
      // Add vital condition
      await playerService.addPlayerCondition(context.player.discordId, statusToAdd);
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
      [PlayerCondition.REFRESHED]: '💧 You feel refreshed and hydrated!',
      [PlayerCondition.FED]: '🍞 You feel well-fed and satisfied!',
      [PlayerCondition.THIRSTY]: '🫗 You feel thirsty.',
      [PlayerCondition.DEHYDRATED]: '🏜️ You feel severely dehydrated.',
      [PlayerCondition.EXHAUSTED]: '😴 You feel exhausted.',
      [PlayerCondition.HEALTHY]: '💚 You feel healthy!',
      [PlayerCondition.WOUNDED]: '🩸 You are wounded.'
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
    const statusToRemove = effect.status as PlayerCondition;
    
    // Check if this is a vital status or temporary condition
    if (isVitalStatus(statusToRemove)) {
      // Handle vital condition removal/change
      if (!context.player.conditions || !context.player.conditions.includes(statusToRemove)) {
        // Silent success if condition isn't present
        return {
          success: true,
          message: '',
          effectData: { statusRemoved: false }
        };
      }
      
      // Remove the vital condition and handle special cases
      await playerService.removePlayerCondition(context.player.discordId, statusToRemove);
      
      if (statusToRemove === PlayerCondition.WOUNDED) {
        // When removing wounded, add healthy
        await playerService.addPlayerCondition(context.player.discordId, PlayerCondition.HEALTHY);
      }
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
    }
      
    const statusMessages: { [key: string]: string } = {
      [PlayerCondition.THIRSTY]: '💧 Your thirst is quenched.',
      [PlayerCondition.DEHYDRATED]: '💧 You are no longer dehydrated.',
      [PlayerCondition.EXHAUSTED]: '⚡ You feel more energetic.',
      [PlayerCondition.FED]: '🍞 You are no longer full.',
      [PlayerCondition.REFRESHED]: '💧 The refreshing effect wears off.',
      [PlayerCondition.WOUNDED]: '💚 You feel healthy again.',
      [PlayerCondition.HEALTHY]: '❓ Health condition removed.'
    };
      
    return {
      success: true,
      message: statusMessages[statusToRemove] || `${statusToRemove} condition removed.`,
      effectData: { statusRemoved: true, removedStatus: statusToRemove }
    };
    
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