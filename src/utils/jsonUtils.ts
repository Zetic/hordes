/**
 * Centralized JSON parsing utility with robust error handling
 * Provides safe JSON operations with fallback values and comprehensive error logging
 */

export interface SafeJsonParseResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * Safely parse JSON string with error handling and fallback value
 * @param jsonString - The JSON string to parse
 * @param fallback - The fallback value to return if parsing fails
 * @param context - Optional context for error logging (e.g., "player conditions", "game state")
 * @returns SafeJsonParseResult with parsed data or fallback value
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  fallback: T,
  context?: string
): SafeJsonParseResult<T> {
  // Handle null, undefined, or empty string cases
  if (!jsonString || jsonString.trim() === '') {
    return {
      success: true,
      data: fallback
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const contextInfo = context ? ` (${context})` : '';
    
    console.warn(`Failed to parse JSON${contextInfo}:`, errorMessage);
    console.warn('Raw JSON string:', jsonString);
    
    return {
      success: false,
      data: fallback,
      error: errorMessage
    };
  }
}

/**
 * Safely parse JSON string and ensure it's an array
 * @param jsonString - The JSON string to parse
 * @param fallback - The fallback array to return if parsing fails or result is not an array
 * @param context - Optional context for error logging
 * @returns SafeJsonParseResult with array data or fallback array
 */
export function safeJsonParseArray<T>(
  jsonString: string | null | undefined,
  fallback: T[] = [],
  context?: string
): SafeJsonParseResult<T[]> {
  const result = safeJsonParse(jsonString, fallback, context);
  
  if (result.success && result.data !== null && result.data !== undefined) {
    // If parsed successfully but not an array, convert single item to array
    if (!Array.isArray(result.data)) {
      const contextInfo = context ? ` (${context})` : '';
      console.warn(`JSON parsed successfully but result is not an array${contextInfo}, converting single value to array:`, result.data);
      
      return {
        success: true,
        data: [result.data as T]
      };
    }
  }
  
  return result as SafeJsonParseResult<T[]>;
}

/**
 * Safely stringify JSON with error handling
 * @param data - The data to stringify
 * @param fallback - The fallback string to return if stringification fails
 * @param context - Optional context for error logging
 * @returns The JSON string or fallback value
 */
export function safeJsonStringify(
  data: any,
  fallback: string = '{}',
  context?: string
): string {
  try {
    const result = JSON.stringify(data);
    // JSON.stringify returns undefined for undefined values, functions, symbols
    if (result === undefined) {
      const contextInfo = context ? ` (${context})` : '';
      console.warn(`JSON.stringify returned undefined${contextInfo}, using fallback`);
      return fallback;
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const contextInfo = context ? ` (${context})` : '';
    
    console.error(`Failed to stringify JSON${contextInfo}:`, errorMessage);
    console.error('Data:', data);
    
    return fallback;
  }
}