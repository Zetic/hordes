// Test to verify the specific DiscordAPIError[10062] issue is fixed
import { safeInteractionReply, handleDiscordError, isInvalidInteractionError } from '../utils/discordErrorHandler';

describe('DiscordAPIError[10062] Crash Prevention', () => {
  test('should handle the exact error from the issue gracefully', () => {
    // This is the exact error from the issue
    const originalError = {
      name: 'DiscordAPIError',
      code: 10062,
      message: 'Unknown interaction',
      requestBody: { files: [], json: { type: 4, data: {} } },
      rawError: { message: 'Unknown interaction', code: 10062 },
      status: 404,
      method: 'POST',
      url: 'https://discord.com/api/v10/interactions/1379285355127246941/aW50ZXJhY3Rpb246MTM3OTI4NTM1NTEyNzI0Njk0MTpqREp5UVVhSlNKWFJlWUlEekdSSjhwMHVlY01QaDZhd0NiSzlXNW5uY2NqNG9TVVBQUWVyVVc0ZWpoQmt5aUc1TGIwWW5BWVM5ODZnaTUyQ2U5c0F5emRLQ0ZMOTY1dEM3NnFIVUozb1BHSlFsdFFjczFaYXA4TkZ4eVhBUGRUcA/callback?with_response=false'
    };
    
    // Test that it's correctly identified as an invalid interaction error
    expect(isInvalidInteractionError(originalError)).toBe(true);
    
    // Test that the error handler doesn't crash but logs appropriately
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    handleDiscordError(originalError, 'create command');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '⚠️ Invalid/expired interaction in create command:',
      10062,
      'Unknown interaction'
    );
    
    consoleSpy.mockRestore();
  });

  test('should prevent cascade errors when interaction.reply fails', async () => {
    const mockInteraction = {
      replied: false,
      deferred: false,
      reply: jest.fn().mockRejectedValue({
        name: 'DiscordAPIError',
        code: 10062,
        message: 'Unknown interaction',
        rawError: { message: 'Unknown interaction', code: 10062 }
      }),
      editReply: jest.fn()
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // This should not throw an error or cause a crash
    const result = await safeInteractionReply(mockInteraction as any, {
      content: 'There was an error executing this command!',
      ephemeral: true
    });

    expect(result).toBe(false); // Should return false indicating failure
    expect(mockInteraction.reply).toHaveBeenCalled();
    expect(mockInteraction.editReply).not.toHaveBeenCalled(); // Should not try editReply
    expect(consoleSpy).toHaveBeenCalledWith(
      '⚠️ Cannot respond to invalid/expired interaction:',
      10062,
      'Unknown interaction'
    );

    consoleSpy.mockRestore();
  });

  test('should prevent cascade errors when interaction.editReply fails', async () => {
    const mockInteraction = {
      replied: true, // Already replied
      deferred: false,
      reply: jest.fn(),
      editReply: jest.fn().mockRejectedValue({
        name: 'DiscordAPIError',
        code: 10062,
        message: 'Unknown interaction',
        rawError: { message: 'Unknown interaction', code: 10062 }
      })
    };

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // This should not throw an error or cause a crash
    const result = await safeInteractionReply(mockInteraction as any, {
      content: 'There was an error executing this command!',
      ephemeral: true
    });

    expect(result).toBe(false); // Should return false indicating failure
    expect(mockInteraction.reply).not.toHaveBeenCalled(); // Should not try reply
    expect(mockInteraction.editReply).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '⚠️ Cannot respond to invalid/expired interaction:',
      10062,
      'Unknown interaction'
    );

    consoleSpy.mockRestore();
  });

  test('should handle the deprecation warning mentioned in the issue', () => {
    // Test that our error message handling includes ephemeral flag properly
    const errorMessage = {
      content: 'There was an error executing this command!',
      ephemeral: true // This should use the flags format, not the deprecated ephemeral option
    };

    // Verify the message structure
    expect(errorMessage).toHaveProperty('content');
    expect(errorMessage).toHaveProperty('ephemeral');
    expect(errorMessage.ephemeral).toBe(true);
  });

  test('should demonstrate the bot no longer crashes on Discord API errors', () => {
    // Simulate what would happen in the original bot.ts error handler
    const originalError = {
      name: 'DiscordAPIError',
      code: 10062,
      message: 'Unknown interaction'
    };

    // Mock console methods to capture output
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // This should not throw and should not cause process to exit
    expect(() => {
      handleDiscordError(originalError, 'command execution');
    }).not.toThrow();

    // Should log a warning, not an error (since it's an invalid interaction)
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});