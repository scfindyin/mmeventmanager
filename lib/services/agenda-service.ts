import { supabase } from "@/lib/supabase"
import type { AgendaItem } from "@/lib/types"
import { recalculateAgendaTimes } from "@/lib/agenda-recalculation"

interface AgendaApiResponse {
  success: boolean;
  item?: AgendaItem;
  items?: AgendaItem[];
  message?: string;
  error?: string;
  details?: any;
}

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
}

interface UpdateItemRequest {
  item: DatabaseItem;
  triggerFullRecalculation?: boolean;
  allItemUpdates?: AgendaItem[];
  fetchAllItems?: boolean;
  skipRefresh?: boolean;
  eventStartTime: string;
}

export class AgendaService {
  private baseUrl: string;
  
  constructor(baseUrl: string = '/api/agenda-items') {
    this.baseUrl = baseUrl;
  }

  private async handleApiResponse(response: AgendaApiResponse): Promise<AgendaApiResponse> {
    if (!response.success) {
      throw new Error(response.error || 'Unknown error occurred');
    }
    return response;
  }

  /**
   * Update an agenda item with batch updates
   */
  async updateItem(itemId: string, updates: any[], eventStartTime: string): Promise<AgendaApiResponse> {
    try {
      // Find the main item being updated
      const mainUpdate = updates.find(u => u.id === itemId);
      if (!mainUpdate) {
        throw new Error('Main item update not found in batch');
      }

      const response = await fetch(`${this.baseUrl}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: mainUpdate,
          allItemUpdates: updates,
          triggerFullRecalculation: true,
          respectDayAssignments: true,
          eventStartTime
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item');
      }

      const result = await response.json();
      return this.handleApiResponse(result);
    } catch (error) {
      console.error('Error in updateItem:', error);
      throw error;
    }
  }

  /**
   * Delete an agenda item
   */
  async deleteItem(id: string, eventStartTime: string): Promise<AgendaApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id, 
          triggerFullRecalculation: true,
          eventStartTime 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete item');
      }

      const result = await response.json();
      return this.handleApiResponse(result);
    } catch (error) {
      console.error('Error in deleteItem:', error);
      throw error;
    }
  }

  /**
   * Move an item to a different day
   */
  async moveItemToDay(
    item: AgendaItem, 
    targetDayIndex: number, 
    newOrder: number,
    eventStartTime: string
  ): Promise<AgendaApiResponse> {
    const dbItem = this.toDatabaseItem(item);
    dbItem.day_index = targetDayIndex;
    dbItem.order_position = newOrder;

    return this.updateItem(item.id, [dbItem], eventStartTime);
  }

  /**
   * Reorder items within a day or across days
   */
  async reorderItems(
    referenceItem: AgendaItem,
    updatedItems: AgendaItem[],
    eventStartTime: string
  ): Promise<AgendaApiResponse> {
    return this.updateItem(referenceItem.id, updatedItems.map(this.toDatabaseItem), eventStartTime);
  }

  /**
   * Get all items for an event
   */
  async getEventItems(eventId: string): Promise<AgendaItem[]> {
    const { data, error } = await supabase
      .from("agenda_items")
      .select("*")
      .eq("event_id", eventId)
      .order("day_index", { ascending: true })
      .order("order_position", { ascending: true });

    if (error) {
      console.error('Error in getEventItems:', error);
      throw error;
    }

    // First assert to unknown, then to DatabaseItem[] for type safety
    const dbItems = (data as unknown) as DatabaseItem[];
    return dbItems.map(item => this.toAgendaItem(item));
  }

  /**
   * Split an item into two
   */
  async splitItem(
    item: AgendaItem, 
    newItemId: string, 
    newOrder: number,
    eventStartTime: string
  ): Promise<AgendaApiResponse> {
    const dbItem = this.toDatabaseItem(item);
    dbItem.id = newItemId;
    dbItem.order_position = newOrder;

    return this.updateItem(newItemId, [dbItem], eventStartTime);
  }

  /**
   * Move an item within its day
   */
  async moveItemInDay(itemId: string, dayIndex: number, newOrder: number, eventStartTime: string, currentItems: AgendaItem[]): Promise<AgendaApiResponse> {
    console.log("Service: Moving item within day:", { itemId, dayIndex, currentOrder: currentItems.find(i => i.id === itemId)?.order, newOrder });
    
    // Find the item being moved to ensure we have all its data
    const itemToMove = currentItems.find(i => i.id === itemId);
    if (!itemToMove) {
      throw new Error('Item not found');
    }

    // Prepare updates with complete item data for ALL items
    const updates = currentItems.map(item => ({
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description,
      duration_minutes: item.durationMinutes,
      day_index: item.dayIndex,
      order_position: item.id === itemId ? newOrder : item.order,
      start_time: item.startTime,
      end_time: item.endTime
    }));

    console.log("Service: Prepared batch update:", {
      itemCount: updates.length,
      movedItem: updates.find(u => u.id === itemId)?.order_position,
      allOrders: updates.filter(u => u.id !== itemId).map(u => u.order_position)
    });

    return this.updateItem(itemId, updates, eventStartTime);
  }

  /**
   * Initialize times for agenda items
   */
  async initializeItemTimes(
    items: AgendaItem[],
    eventStartTime: string
  ): Promise<AgendaItem[]> {
    if (items.length === 0) return items;

    // Use the first item as reference for the API call
    const referenceItem = this.toDatabaseItem(items[0]);

    const result = await this.updateItem(referenceItem.id, items.map(this.toDatabaseItem), eventStartTime);

    if (!result.items) {
      throw new Error('No items returned from initialization');
    }

    return result.items;
  }

  /**
   * Convert AgendaItem to DatabaseItem format
   */
  private toDatabaseItem(item: AgendaItem): DatabaseItem {
    return {
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description || "",
      duration_minutes: item.durationMinutes,
      day_index: item.dayIndex,
      order_position: item.order,
      start_time: item.startTime,
      end_time: item.endTime
    };
  }

  /**
   * Convert DatabaseItem to AgendaItem format
   */
  private toAgendaItem(item: DatabaseItem): AgendaItem {
    return {
      id: item.id,
      event_id: item.event_id,
      topic: item.topic,
      description: item.description || "",
      durationMinutes: item.duration_minutes,
      dayIndex: item.day_index,
      order: item.order_position,
      startTime: item.start_time,
      endTime: item.end_time
    };
  }

  calculateItemTimes(items: AgendaItem[], eventStartTime: string): AgendaItem[] {
    if (items.length === 0) return items;
    
    // Group items by day
    const itemsByDay: Record<number, AgendaItem[]> = {};
    items.forEach((item) => {
      if (!itemsByDay[item.dayIndex]) {
        itemsByDay[item.dayIndex] = [];
      }
      itemsByDay[item.dayIndex].push(item);
    });

    const updatedItems: AgendaItem[] = [];

    // Process each day's items
    Object.keys(itemsByDay).forEach((dayIndexStr) => {
      const dayIndex = Number.parseInt(dayIndexStr);
      // Make sure to sort by the integer order value
      const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order);

      let currentTime = eventStartTime; // Use event start time

      dayItems.forEach((item) => {
        // Set the start time for this item
        const startTime = currentTime;

        // Calculate the end time based on duration
        const endTime = this.addMinutesToTime(startTime, item.durationMinutes);

        // Add the updated item to the result
        updatedItems.push({
          ...item,
          startTime,
          endTime,
        });

        // Update current time for the next item
        currentTime = endTime;
      });
    });

    return updatedItems;
  }

  private addMinutesToTime(timeStr: string, minutes: number): string {
    const [hours, mins] = timeStr.split(":").map(Number);
    const totalMinutes = hours * 60 + mins + minutes;

    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;

    return `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`;
  }
}

// Export a singleton instance
export const agendaService = new AgendaService(); 