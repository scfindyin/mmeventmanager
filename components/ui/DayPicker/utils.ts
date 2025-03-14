// components/ui/DayPicker/utils.ts

/**
 * Formats a date with proper ordinal suffix (e.g., "March 7th, 2025")
 * @param date The date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date): string => {
    if (!date) return '';
    
    const months: string[] = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const day: number = date.getDate();
    const month: string = months[date.getMonth()];
    const year: number = date.getFullYear();
    
    return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
  };
  
  /**
   * Gets the ordinal suffix for a number (e.g., 1st, 2nd, 3rd, 4th)
   * @param n The number to get the suffix for
   * @returns The ordinal suffix
   */
  export const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };