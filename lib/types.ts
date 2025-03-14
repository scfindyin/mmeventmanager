// Database Types
export interface Event {
  id: string;
  title: string;
  subtitle?: string;
  notes?: string;
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
  hoursOfOperation: {
    [date: string]: {    // date in YYYY-MM-DD format
      startTime: string; // HH:mm format
      endTime: string;   // HH:mm format
    };
  };
  attendees: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  agendaItems: AgendaItem[];
  logo_url: string | null;
  created_at: string; // ISO timestamp from Supabase
  adhereToTimeRestrictions?: boolean; // Whether to enforce time restrictions (default: true)
}

export interface AgendaItem {
  id: string;
  event_id: string;
  topic: string;
  description?: string;
  durationMinutes: number;  // Changed from duration for clarity
  dayIndex: number;        // Changed from day_index for consistency
  order: number;          // Changed from position for consistency
  startTime: string;      // Format "HH:mm" for consistency
  endTime: string;        // Format "HH:mm" for consistency
}

export interface SubItem {
  id: string;
  agenda_item_id: string;
  content: string;
  position: number;
}

export interface Attendee {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
}

// Frontend Types with parsed dates
export interface EventWithDates {
  id: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  start_date: Date;     // Parsed JavaScript Date object
  end_date: Date;       // Parsed JavaScript Date object
  start_time: string | null;
  end_time: string | null;
  logo_url: string | null;
  created_at: Date;     // Parsed JavaScript Date object
  adhere_to_time_restrictions?: boolean; // Whether to enforce time restrictions (default: true)
}

// Date utilities for the new date types
export const dateUtils = {
  /**
   * Convert Supabase date string to JavaScript Date
   */
  parseDate: (dateStr: string): Date => {
    return new Date(dateStr);
  },

  /**
   * Format date for display
   */
  formatDate: (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Format date for API submission (ISO format)
   */
  toISODateString: (date: Date): string => {
    return date.toISOString().split('T')[0];
  },

  /**
   * Parse time string (e.g., "09:00:00") to get hours and minutes
   */
  parseTime: (timeStr: string | null): { hours: number, minutes: number } | null => {
    if (!timeStr) return null;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  },

  /**
   * Format time for display (e.g., "9:00 AM")
   */
  formatTime: (timeStr: string | null): string => {
    if (!timeStr) return '';
    
    const { hours, minutes } = dateUtils.parseTime(timeStr) || { hours: 0, minutes: 0 };
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  },

  /**
   * Convert Event from API to EventWithDates for frontend use
   */
  eventToEventWithDates: (event: Event): EventWithDates => {
    return {
      ...event,
      start_date: dateUtils.parseDate(event.startDate),
      end_date: dateUtils.parseDate(event.endDate),
      created_at: dateUtils.parseDate(event.created_at)
    };
  },

  /**
   * Convert EventWithDates back to Event for API submission
   */
  eventWithDatesToEvent: (eventWithDates: EventWithDates): Event => {
    return {
      ...eventWithDates,
      startDate: dateUtils.toISODateString(eventWithDates.start_date),
      endDate: dateUtils.toISODateString(eventWithDates.end_date),
      created_at: eventWithDates.created_at.toISOString(),
      adhereToTimeRestrictions: eventWithDates.adhere_to_time_restrictions,
      hoursOfOperation: {}, // Add default values to satisfy the type checker
      attendees: [],
      agendaItems: []
    };
  }
}; 