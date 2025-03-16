/**
 * Debug utilities for the application
 */

/**
 * Print detailed type information about a value
 */
export function printTypeInfo(label: string, value: any): void {
  console.log(`--- DEBUG ${label} ---`);
  console.log(`Value: ${value}`);
  console.log(`Type: ${typeof value}`);
  
  if (typeof value === 'object') {
    console.log(`Is null: ${value === null}`);
    if (value !== null) {
      console.log(`Constructor: ${value.constructor?.name}`);
      console.log(`Is array: ${Array.isArray(value)}`);
      console.log(`Keys: ${Object.keys(value).join(', ')}`);
    }
  } else if (typeof value === 'number') {
    console.log(`Is NaN: ${isNaN(value)}`);
    console.log(`Is integer: ${Number.isInteger(value)}`);
  }
  
  console.log('----------------------');
}

/**
 * Ensure a value is a number 
 * @param value The value to convert to a number
 * @param defaultValue The default value if conversion fails
 * @returns The numeric value
 */
export function ensureNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  
  return defaultValue;
} 