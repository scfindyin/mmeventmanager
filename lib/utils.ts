import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert a JavaScript Date to a string suitable for database storage (YYYY-MM-DD)
export function dateToDbString(date: Date): string {
  try {
    // Create a string in YYYY-MM-DD format directly from date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Add 1 because JS months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return format(new Date(), "yyyy-MM-dd");
  }
}

// Convert a database date string to a JavaScript Date object 
// This ensures consistent parsing regardless of timezone
export function dbStringToDate(dateString: string | null | undefined): Date {
  // If dateString is null or undefined, return the current date
  if (!dateString) {
    return new Date();
  }

  try {
    // Handle ISO format strings that might come from API or direct DB access
    if (dateString.includes("T")) {
      // Parse ISO string but preserve the date part only - avoids timezone shifts
      const dateParts = dateString.split('T')[0].split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
      const day = parseInt(dateParts[2], 10);
      
      // Create date at local noon to ensure consistent display
      const result = new Date();
      result.setFullYear(year, month, day);
      result.setHours(12, 0, 0, 0);
      return result;
    }
    
    // Handle YYYY-MM-DD format (what we store in the database)
    // Parse directly from components to avoid timezone issues
    const dateParts = dateString.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(dateParts[2], 10);
    
    // Create date at local noon to ensure consistent display
    const result = new Date();
    result.setFullYear(year, month, day);
    result.setHours(12, 0, 0, 0);
    return result;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return new Date();
  }
}

// Format a date string for display
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  try {
    // If it's a YYYY-MM-DD format string, we need to handle timezone issues
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      // For YYYY-MM-DD format, parse with explicit time to avoid timezone issues
      // By adding T00:00:00 we ensure it's parsed at midnight UTC
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC' // Use UTC to avoid timezone shifts
      });
    }
    
    // Handle if dateString is already a Date object or other format
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date: ${dateString}`);
      return String(dateString); // Return original if parsing fails
    }
    
    // Format the date into a user-friendly format
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    // Return the original string if there's an error
    return String(dateString);
  }
}

export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  // Handle ISO format date from database (YYYY-MM-DD)
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return '';
  
  try {
    // Handle PostgreSQL time format (HH:MM:SS)
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
}

// Function to format a date for input date fields (YYYY-MM-DD)
export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  // Handle ISO format date from database
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  // Format as YYYY-MM-DD for HTML date inputs
  return date.toISOString().split('T')[0];
}

// Function to format a time for input time fields (HH:MM)
export function formatTimeForInput(timeString: string | null | undefined): string {
  if (!timeString) return '';
  
  try {
    // Handle PostgreSQL time format (HH:MM:SS)
    // Extract just HH:MM for input time fields
    return timeString.split(':').slice(0, 2).join(':');
  } catch (error) {
    console.error('Error formatting time for input:', error);
    return '';
  }
}

// Helper to combine date and time into a full date object
export function combineDateTime(dateStr: string, timeStr: string | null): Date {
  if (!dateStr) return new Date();
  
  const date = new Date(dateStr);
  
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }
  
  return date;
}

// Validate if string is a properly formatted date
export function isValidDateString(dateString: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

