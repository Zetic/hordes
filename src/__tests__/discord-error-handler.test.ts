// Test file to verify Discord error handling functionality
import { 
  isDiscordAPIError, 
  isInvalidInteractionError, 
  safeInteractionReply,
  handleDiscordError 
} from '../utils/discordErrorHandler';

describe('Discord Error Handler', () => {
  describe('Error Detection', () => {
    test('should detect Discord API errors correctly', () => {
      const discordError = {
        code: 10062,
        name: 'DiscordAPIError',
        message: 'Unknown interaction',
        rawError: { message: 'Unknown interaction', code: 10062 }
      };
      
      expect(isDiscordAPIError(discordError)).toBe(true);
      expect(isDiscordAPIError(discordError, 10062)).toBe(true);
      expect(isDiscordAPIError(discordError, 10008)).toBe(false);
    });

    test('should detect invalid interaction errors', () => {
      const unknownInteractionError = {
        code: 10062,
        name: 'DiscordAPIError',
        message: 'Unknown interaction'
      };
      
      const unknownMessageError = {
        code: 10008,
        name: 'DiscordAPIError',
        message: 'Unknown message'
      };
      
      const alreadyAcknowledgedError = {
        code: 40060,
        name: 'DiscordAPIError',
        message: 'Interaction has already been acknowledged'
      };
      
      const normalError = {
        code: 50001,
        name: 'DiscordAPIError',
        message: 'Missing access'
      };

      expect(isInvalidInteractionError(unknownInteractionError)).toBe(true);
      expect(isInvalidInteractionError(unknownMessageError)).toBe(true);
      expect(isInvalidInteractionError(alreadyAcknowledgedError)).toBe(true);
      expect(isInvalidInteractionError(normalError)).toBe(false);
    });

    test('should not detect non-Discord errors as Discord API errors', () => {
      const normalError = new Error('Regular error');
      const customError = { message: 'Custom error' };
      
      expect(isDiscordAPIError(normalError)).toBe(false);
      expect(isDiscordAPIError(customError)).toBe(false);
      expect(isInvalidInteractionError(normalError)).toBe(false);
      expect(isInvalidInteractionError(customError)).toBe(false);
    });
  });

  describe('Safe Interaction Reply', () => {
    test('should handle interaction reply gracefully', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined)
      };

      const result = await safeInteractionReply(mockInteraction as any, { content: 'Test' });

      expect(result).toBe(true);
      expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Test' });
      expect(mockInteraction.editReply).not.toHaveBeenCalled();
    });

    test('should use editReply when interaction is already replied', async () => {
      const mockInteraction = {
        replied: true,
        deferred: false,
        reply: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined)
      };

      const result = await safeInteractionReply(mockInteraction as any, { content: 'Test' });

      expect(result).toBe(true);
      expect(mockInteraction.editReply).toHaveBeenCalledWith({ content: 'Test' });
      expect(mockInteraction.reply).not.toHaveBeenCalled();
    });

    test('should handle invalid interaction errors gracefully', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockRejectedValue({
          code: 10062,
          name: 'DiscordAPIError',
          message: 'Unknown interaction'
        }),
        editReply: jest.fn().mockResolvedValue(undefined)
      };

      // Mock console.warn to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await safeInteractionReply(mockInteraction as any, { content: 'Test' });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Cannot respond to invalid/expired interaction:', 
        10062, 
        'Unknown interaction'
      );

      consoleSpy.mockRestore();
    });

    test('should handle general Discord API errors gracefully', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockRejectedValue({
          code: 50001,
          name: 'DiscordAPIError',
          message: 'Missing access'
        }),
        editReply: jest.fn().mockResolvedValue(undefined)
      };

      // Mock console.error to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await safeInteractionReply(mockInteraction as any, { content: 'Test' });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Discord API error during interaction reply:', 
        50001, 
        'Missing access'
      );

      consoleSpy.mockRestore();
    });

    test('should re-throw non-Discord errors', async () => {
      const mockInteraction = {
        replied: false,
        deferred: false,
        reply: jest.fn().mockRejectedValue(new Error('Network error')),
        editReply: jest.fn().mockResolvedValue(undefined)
      };

      await expect(
        safeInteractionReply(mockInteraction as any, { content: 'Test' })
      ).rejects.toThrow('Network error');
    });
  });

  describe('Error Handler Function', () => {
    test('should handle invalid interaction errors with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const error = {
        code: 10062,
        name: 'DiscordAPIError',
        message: 'Unknown interaction'
      };

      handleDiscordError(error, 'test operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️ Invalid/expired interaction in test operation:', 
        10062, 
        'Unknown interaction'
      );

      consoleSpy.mockRestore();
    });

    test('should handle Discord API errors with error logging', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = {
        code: 50001,
        name: 'DiscordAPIError',
        message: 'Missing access'
      };

      handleDiscordError(error, 'test operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Discord API error in test operation:', 
        50001, 
        'Missing access'
      );

      consoleSpy.mockRestore();
    });

    test('should handle regular errors with full error logging', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const error = new Error('Regular error');

      handleDiscordError(error, 'test operation');

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Error in test operation:', 
        error
      );

      consoleSpy.mockRestore();
    });
  });
});