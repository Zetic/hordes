import { safeJsonParse, safeJsonParseArray, safeJsonStringify } from '../utils/jsonUtils';

describe('JSON Utils - Safe JSON Operations', () => {
  describe('safeJsonParse', () => {
    test('should parse valid JSON correctly', () => {
      const result = safeJsonParse('{"key": "value"}', {}, 'test context');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
      expect(result.error).toBeUndefined();
    });

    test('should return fallback for invalid JSON', () => {
      const fallback = { default: true };
      const result = safeJsonParse('invalid json', fallback, 'test context');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should return fallback for null input', () => {
      const fallback = { default: true };
      const result = safeJsonParse(null, fallback, 'test context');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should return fallback for undefined input', () => {
      const fallback = { default: true };
      const result = safeJsonParse(undefined, fallback, 'test context');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should return fallback for empty string', () => {
      const fallback = { default: true };
      const result = safeJsonParse('', fallback, 'test context');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should return fallback for whitespace-only string', () => {
      const fallback = { default: true };
      const result = safeJsonParse('   ', fallback, 'test context');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should work without context parameter', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });
  });

  describe('safeJsonParseArray', () => {
    test('should parse valid JSON array correctly', () => {
      const result = safeJsonParseArray('["item1", "item2"]', [], 'test array');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['item1', 'item2']);
      expect(result.error).toBeUndefined();
    });

    test('should convert single JSON value to array', () => {
      const result = safeJsonParseArray('"single_item"', [], 'test array');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(['single_item']);
      expect(result.error).toBeUndefined();
    });

    test('should return fallback array for invalid JSON', () => {
      const fallback = ['default'];
      const result = safeJsonParseArray('invalid json', fallback, 'test array');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeDefined();
    });

    test('should return empty array as default fallback', () => {
      const result = safeJsonParseArray('invalid json', undefined, 'test array');
      
      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
    });

    test('should return fallback for null input', () => {
      const fallback = ['default'];
      const result = safeJsonParseArray(null, fallback, 'test array');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(fallback);
      expect(result.error).toBeUndefined();
    });

    test('should convert object to single-item array', () => {
      const result = safeJsonParseArray('{"key": "value"}', [], 'test array');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ key: 'value' }]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('safeJsonStringify', () => {
    test('should stringify object correctly', () => {
      const data = { key: 'value', number: 42 };
      const result = safeJsonStringify(data, '{}', 'test stringify');
      
      expect(result).toBe('{"key":"value","number":42}');
    });

    test('should stringify array correctly', () => {
      const data = ['item1', 'item2', 123];
      const result = safeJsonStringify(data, '[]', 'test stringify');
      
      expect(result).toBe('["item1","item2",123]');
    });

    test('should return fallback for circular reference', () => {
      const circularObj: any = { key: 'value' };
      circularObj.circular = circularObj; // Create circular reference
      
      const fallback = '{"error": "circular"}';
      const result = safeJsonStringify(circularObj, fallback, 'test stringify');
      
      expect(result).toBe(fallback);
    });

    test('should use default fallback when none provided', () => {
      const circularObj: any = { key: 'value' };
      circularObj.circular = circularObj;
      
      const result = safeJsonStringify(circularObj);
      
      expect(result).toBe('{}');
    });

    test('should work without context parameter', () => {
      const data = { key: 'value' };
      const result = safeJsonStringify(data);
      
      expect(result).toBe('{"key":"value"}');
    });

    test('should stringify undefined as undefined (JSON behavior)', () => {
      const result = safeJsonStringify(undefined, 'fallback', 'test stringify');
      
      expect(result).toBe('fallback'); // undefined cannot be JSON stringified
    });

    test('should stringify functions as undefined (JSON behavior)', () => {
      const data = { func: () => 'test' };
      const result = safeJsonStringify(data, 'fallback', 'test stringify');
      
      expect(result).toBe('{}'); // Functions are omitted in JSON
    });
  });
});