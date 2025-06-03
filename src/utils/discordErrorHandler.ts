import { CommandInteraction, ButtonInteraction, StringSelectMenuInteraction, InteractionResponse, Message } from 'discord.js';

/**
 * Discord API Error codes that indicate the interaction is invalid or expired
 */
const INVALID_INTERACTION_CODES = [
  10062, // Unknown interaction
  10008, // Unknown message
  40060, // Interaction has already been acknowledged
];

/**
 * Check if an error is a Discord API error with a specific code
 */
export function isDiscordAPIError(error: any, code?: number): boolean {
  if (!error || !error.code) {
    return false;
  }
  
  const isDiscordError = error.name === 'DiscordAPIError' || error.rawError;
  if (!isDiscordError) {
    return false;
  }
  
  return code ? error.code === code : true;
}

/**
 * Check if the Discord API error indicates an invalid/expired interaction
 */
export function isInvalidInteractionError(error: any): boolean {
  return isDiscordAPIError(error) && INVALID_INTERACTION_CODES.includes(error.code);
}

/**
 * Safely attempt to respond to a Discord interaction with proper error handling
 * Returns true if successful, false if the interaction is invalid/expired
 */
export async function safeInteractionReply(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  content: any
): Promise<boolean> {
  try {
    // Don't attempt to respond if we know the interaction is invalid
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(content);
    } else {
      await interaction.reply(content);
    }
    return true;
  } catch (error: any) {
    // If it's an invalid interaction error, log it but don't crash
    if (isInvalidInteractionError(error)) {
      console.warn('⚠️ Cannot respond to invalid/expired interaction:', error.code, error.message);
      return false;
    }
    
    // For other Discord API errors, log and don't crash
    if (isDiscordAPIError(error)) {
      console.error('❌ Discord API error during interaction reply:', error.code, error.message);
      return false;
    }
    
    // For non-Discord errors, re-throw to handle elsewhere
    throw error;
  }
}

/**
 * Safely attempt a followUp to a Discord interaction
 */
export async function safeInteractionFollowUp(
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  content: any
): Promise<boolean> {
  try {
    await interaction.followUp(content);
    return true;
  } catch (error: any) {
    if (isInvalidInteractionError(error)) {
      console.warn('⚠️ Cannot follow up on invalid/expired interaction:', error.code, error.message);
      return false;
    }
    
    if (isDiscordAPIError(error)) {
      console.error('❌ Discord API error during interaction follow up:', error.code, error.message);
      return false;
    }
    
    throw error;
  }
}

/**
 * Safely handle any Discord interaction error
 * This should be used in catch blocks to prevent bot crashes
 */
export function handleDiscordError(error: any, context: string = 'Discord operation'): void {
  if (isInvalidInteractionError(error)) {
    console.warn(`⚠️ Invalid/expired interaction in ${context}:`, error.code, error.message);
    return;
  }
  
  if (isDiscordAPIError(error)) {
    console.error(`❌ Discord API error in ${context}:`, error.code, error.message);
    return;
  }
  
  // For non-Discord errors, log the full error
  console.error(`❌ Error in ${context}:`, error);
}