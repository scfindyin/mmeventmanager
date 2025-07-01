import type { AgendaItem } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface DatabaseItem {
  id: string;
  event_id: string;
  topic: string;
  description?: string;
  duration_minutes: number;
  day_index: number;
  order_position: number;
  start_time: string;
  end_time: string;
  is_filler: boolean;
}

/**
 * Convert DatabaseItem to AgendaItem format
 */
export function toAgendaItem(item: DatabaseItem): AgendaItem {
  return {
    id: item.id,
    event_id: item.event_id,
    topic: item.topic,
    description: item.description || "",
    durationMinutes: item.duration_minutes,
    dayIndex: item.day_index,
    order: item.order_position,
    startTime: item.start_time,
    endTime: item.end_time,
    is_filler: item.is_filler || false
  };
}

/**
 * Convert AgendaItem to DatabaseItem format
 */
export function toDatabaseItem(item: AgendaItem): DatabaseItem {
  return {
    id: item.id,
    event_id: item.event_id,
    topic: item.topic,
    description: item.description || "",
    duration_minutes: item.durationMinutes,
    day_index: item.dayIndex,
    order_position: item.order,
    start_time: item.startTime,
    end_time: item.endTime,
    is_filler: item.is_filler || false
  };
}

/**
 * Recalculate times for all items in an event
 * Can work with either DatabaseItems or AgendaItems
 * If useServer is true, will use the API for recalculation
 */
export async function recalculateAgendaTimes(
  items: DatabaseItem[] | AgendaItem[],
  eventStartTime: string,
  onComplete?: (items: AgendaItem[]) => void,
  useServer: boolean = false, // DEBUG MODE: Default to false to skip server updates
  sessionStorageKey: string = 'lastDragOperation'
): Promise<AgendaItem[]> {
  // Show loading toast if message provided
  if (items.length === 0) return [];

  // Convert AgendaItems to DatabaseItems if needed
  const dbItems: DatabaseItem[] = (items[0] as any).durationMinutes 
    ? items.map(item => toDatabaseItem(item as AgendaItem))
    : items as DatabaseItem[];

  // DEBUG MODE: Skip server recalculation
  if (useServer) {
    console.log("DEBUG: Skipping server recalculation");
    useServer = false;
  }

  // Local recalculation
  // Group items by day
  const itemsByDay: Record<number, DatabaseItem[]> = {};
  dbItems.forEach(item => {
    if (!itemsByDay[item.day_index]) {
      itemsByDay[item.day_index] = [];
    }
    itemsByDay[item.day_index].push(item);
  });

  // Process each day
  const recalculatedItems: DatabaseItem[] = [];
  Object.entries(itemsByDay).forEach(([dayIndex, dayItems]) => {
    let currentTime = eventStartTime; // Use the provided start time
    
    // Sort items by order position
    dayItems.sort((a, b) => a.order_position - b.order_position);
    
    // Update times for each item
    dayItems.forEach(item => {
      // Set start time
      item.start_time = currentTime;
      
      // Calculate end time
      const [hours, minutes] = currentTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + item.duration_minutes;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      item.end_time = `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
      
      // Set next start time
      currentTime = item.end_time;
      
      recalculatedItems.push(item);
    });
  });

  // Convert to AgendaItems
  const agendaItems = recalculatedItems.map(toAgendaItem);

  // Call onComplete if provided
  if (onComplete) {
    onComplete(agendaItems);
  }

  return agendaItems;
} 