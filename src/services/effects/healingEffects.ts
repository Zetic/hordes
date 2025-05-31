import { ItemEffect, ItemUseContext, ItemUseResult } from '../../types/itemEffects';

export async function handleHealPlayerEffect(effect: ItemEffect, context: ItemUseContext): Promise<ItemUseResult> {
  try {
    const healAmount = effect.value || 10;
    const currentHealth = context.player.health;
    const maxHealth = context.player.maxHealth;
    
    if (currentHealth >= maxHealth) {
      return {
        success: false,
        message: 'You are already at full health.'
      };
    }

    const newHealth = Math.min(currentHealth + healAmount, maxHealth);
    const actualHealAmount = newHealth - currentHealth;
    
    // Note: In a real implementation, we would update the player's health in the database here
    // For now, we return the result that can be processed by the calling code
    
    return {
      success: true,
      message: `Healed ${actualHealAmount} health points. Health is now ${newHealth}/${maxHealth}.`,
      effectData: {
        healAmount: actualHealAmount,
        newHealth,
        maxHealth
      }
    };

  } catch (error) {
    console.error('Error executing heal player effect:', error);
    return {
      success: false,
      message: 'An error occurred while trying to heal.'
    };
  }
}