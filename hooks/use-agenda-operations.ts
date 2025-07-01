import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { agendaService } from '@/lib/services/agenda-service'
import type { AgendaItem } from '@/lib/types'
import { getErrorMessage } from '@/lib/error-utils'
import { v4 as uuidv4 } from 'uuid'

// Helper to preserve scroll position
const withScrollPreservation = async (callback: () => Promise<any>) => {
  // Save current scroll position
  const scrollY = window.scrollY;
  
  try {
    // Execute the callback
    const result = await callback();
    
    // Restore scroll position
    setTimeout(() => window.scrollTo(0, scrollY), 0);
    
    return result;
  } catch (error) {
    // Still restore scroll position even if there's an error
    setTimeout(() => window.scrollTo(0, scrollY), 0);
    throw error;
  }
};

export interface UseAgendaOperationsProps {
  onReorder: (items: AgendaItem[], skipRefresh?: boolean) => void
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
  eventStartTime: string
}

interface DragResult {
  source: { droppableId: string; index: number }
  destination: { droppableId: string; index: number } | null
  draggableId: string
}

export const useAgendaOperations = ({ onReorder = () => {}, toast, eventStartTime }: UseAgendaOperationsProps) => {
  const [isLoading, setIsLoading] = useState(false)

  // Helper function that normalizes all days in place
  const normalizeOrderPositions = (items: AgendaItem[]): void => {
    // Get all unique day indices
    const allDayIndices = new Set(items.map(item => item.dayIndex));
    
    // Normalize each day
    allDayIndices.forEach(dayIndex => {
      // Get items for this day and sort by order
      const dayItems = items
        .filter(item => item.dayIndex === dayIndex)
        .sort((a, b) => a.order - b.order);
        
      // Assign evenly spaced order values (0, 1000, 2000, etc.)
      dayItems.forEach((item, index) => {
        const normalizedOrder = index * 1000;
        
        // Find and update the item directly in the items array
        const itemIndex = items.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          items[itemIndex].order = normalizedOrder;
        }
      });
    });
  };

  // Helper function for database updates
  const updateDatabase = async (operation: string, items: AgendaItem[], skipUpdate: boolean = false) => {
    try {
      // Get the event ID from the first item
      const eventId = items[0]?.event_id;
      if (!eventId) {
        throw new Error('No event ID found');
      }
      
      // Create a copy of the items array we can modify
      let normalizedItems = [...items];
      
      // Normalize all positions for consistency
      normalizeOrderPositions(normalizedItems);
      
      // Recalculate all item times based on the normalized positions
      const recalculatedItems = await agendaService.calculateItemTimes(normalizedItems, eventStartTime);

      // Use the batch-order endpoint to ensure all items are updated consistently
      const response = await fetch(`/api/events/${eventId}/items/batch-order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: recalculatedItems.map(item => ({
            id: item.id,
            event_id: item.event_id,
            topic: item.topic || "Untitled Item",
            description: item.description || "",
            duration_minutes: item.durationMinutes,
            day_index: item.dayIndex,
            order_position: item.order,
            start_time: item.startTime || "00:00",
            end_time: item.endTime || "00:00",
            is_filler: item.is_filler || false
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to update database`;
        console.error("Batch update error details:", errorData);
        throw new Error(errorMessage);
      }

      console.log(`Database ${operation} successful`);
      
      // Return the recalculated items for UI updates
      return recalculatedItems;
    } catch (error) {
      console.error(`Error in database ${operation}:`, error);
      toast({
        title: "Error",
        description: `Failed to ${operation} items in database. Please try again.`,
        variant: "destructive",
      });
      return items; // Return original items on error
    }
  };

  // Delete an agenda item
  const deleteItem = async (item: AgendaItem, currentItems: AgendaItem[]) => {
    try {
      // First, explicitly delete the item from the database
      const eventId = item.event_id;
      const deleteResponse = await fetch(`/api/events/${eventId}/items/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        console.error("Delete API error:", errorData);
        throw new Error(errorData.error || "Failed to delete item");
      }

      console.log(`Item ${item.id} successfully deleted from database`);

      // Create new items array without the deleted item
      let newItems = currentItems.filter((i: AgendaItem) => i.id !== item.id);

      // Normalize all days
      normalizeOrderPositions(newItems);

      // First update UI with locally recalculated times
      const localRecalculatedItems = agendaService.calculateItemTimes(newItems, eventStartTime);
      onReorder(localRecalculatedItems);
      
      // Update database in background
      updateDatabase('delete', newItems);
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      });
    }
  }

  // Split an item into two identical items
  const splitItem = async (origItem: AgendaItem, newItem: AgendaItem, currentItems: AgendaItem[]) => {
    setIsLoading(true);
    try {
      // Create an exact copy with the same duration (true copy)
      const updatedOrigItem = { ...origItem };
      
      const updatedNewItem = { 
        ...newItem,
        durationMinutes: origItem.durationMinutes // Keep the same duration as original
      };
      
      // Create a new items array with both updated items
      const newItems = currentItems
        .filter(item => item.id !== origItem.id) // Remove the original item
        .concat([updatedOrigItem, updatedNewItem]); // Add both updated items
      
      // Normalize the order positions
      normalizeOrderPositions(newItems);

      // First update UI with locally recalculated times
      const localRecalculatedItems = agendaService.calculateItemTimes(newItems, eventStartTime);
      onReorder(localRecalculatedItems);
      
      // Update database in background and get recalculated items
      const updatedItems = await updateDatabase('split', newItems);
      
      // Update UI again with server-recalculated items
      onReorder(updatedItems);
      
      // Return both item IDs
      return {
        originalItemId: updatedOrigItem.id,
        newItemId: updatedNewItem.id
      };
    } catch (error) {
      console.error("Error splitting item:", error);
      toast({
        title: "Error",
        description: "Failed to split item. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  // Move item within the same day
  const moveItemInDay = async (item: AgendaItem, direction: "up" | "down" | "top" | "bottom", currentItems: AgendaItem[]) => {
    // Get all items in the same day
    const dayItems = currentItems.filter(i => i.dayIndex === item.dayIndex)
      .sort((a, b) => a.order - b.order);
    
    const currentIndex = dayItems.findIndex(i => i.id === item.id);
    if (currentIndex === -1) return;

    // Calculate new positions
    let newItems = [...currentItems];
    let targetIndex;
    
    switch (direction) {
      case "up":
        if (currentIndex > 0) targetIndex = currentIndex - 1;
        break;
      case "down":
        if (currentIndex < dayItems.length - 1) targetIndex = currentIndex + 1;
        break;
      case "top":
        targetIndex = 0;
        break;
      case "bottom":
        targetIndex = dayItems.length - 1;
        break;
    }

    if (targetIndex === undefined) return;

    // Remove item from current position
    const [movedItem] = dayItems.splice(currentIndex, 1);
    // Insert at new position
    dayItems.splice(targetIndex, 0, movedItem);

    // Create new items array with the updated order
    const itemsInNewOrder = currentItems.map(originalItem => {
      // If the item is not in this day, keep it unchanged
      if (originalItem.dayIndex !== item.dayIndex) {
        return originalItem;
      }
      
      // Find the item's new position in the rearranged dayItems array
      const newPosition = dayItems.findIndex(i => i.id === originalItem.id);
      if (newPosition === -1) {
        return originalItem; // This shouldn't happen, but just in case
      }
      
      // Return the item with its new order based on position
      return {
        ...originalItem,
        order: newPosition * 1000 // Use a step of 1000 for easier insertions later
      };
    });

    // Update database first and get recalculated items
    const updatedItems = await updateDatabase('move', itemsInNewOrder, false);

    // Only update UI after database operation succeeds
    onReorder(updatedItems);
  }

  // Move item to a different day
  const moveItemToDay = async (
    updatedItem: AgendaItem,
    direction: "previous" | "next",
    currentItems: AgendaItem[],
    totalDays?: number
  ) => {
    // Check if move is valid
    const sourceDayIndex = currentItems.find(i => i.id === updatedItem.id)?.dayIndex;
    if (sourceDayIndex === undefined) {
      console.error("Source item not found in current items:", updatedItem.id);
      return;
    }
    
    const targetDayIndex = updatedItem.dayIndex;
    
    // Validate the move
    if (Math.abs(targetDayIndex - sourceDayIndex) !== 1) {
      console.error(`Invalid day move: Can only move one day at a time. Source: ${sourceDayIndex}, Target: ${targetDayIndex}`);
      return;
    }
    
    // Check if the target day is within bounds
    if (targetDayIndex < 0 || (totalDays !== undefined && targetDayIndex >= totalDays)) {
      console.error(`Invalid day move: Target day ${targetDayIndex} is out of bounds (0-${totalDays ? totalDays - 1 : '?'})`);
      return;
    }

    // Create updated items array
    const updatedItems = currentItems.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    );

    // Normalize all days
    normalizeOrderPositions(updatedItems);
    
    // First update UI with locally recalculated times
    const localRecalculatedItems = agendaService.calculateItemTimes(updatedItems, eventStartTime);
    onReorder(localRecalculatedItems);
    
    // Update database and get recalculated items
    const finalItems = await updateDatabase('move', updatedItems);
    
    // Update UI again with server-recalculated items
    onReorder(finalItems);
  };

  // Handle drag and drop end
  const handleDragEnd = async (result: any, currentItems: AgendaItem[]) => {
    // If dropped outside droppable area
    if (!result.destination) return;
    
    const source = result.source;
    const destination = result.destination;
    
    // If dropped in the same position
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }
    
    // Extract day indices from droppableId (format: "day-X")
    const sourceDayIndex = parseInt(source.droppableId.split('-')[1]);
    const destDayIndex = parseInt(destination.droppableId.split('-')[1]);
    
    // Find the moved item
    const movedItem = currentItems.find(item => 
      item.dayIndex === sourceDayIndex && 
      currentItems.filter(i => i.dayIndex === sourceDayIndex)
        .sort((a, b) => a.order - b.order)
        .indexOf(item) === source.index
    );
    
    if (!movedItem) return;

    // Get items in destination day, excluding the moved item if it's the same day
    const destDayItems = currentItems
      .filter(item => item.dayIndex === destDayIndex && item.id !== movedItem.id)
      .sort((a, b) => a.order - b.order);

    // Calculate new order position
    let newOrder;
    if (destDayItems.length === 0) {
      // If day is empty, use base order
      newOrder = 1000;
    } else if (destination.index === 0) {
      // If moving to start of day
      newOrder = destDayItems[0].order - 1000;
    } else if (destination.index >= destDayItems.length) {
      // If moving to end of day
      newOrder = destDayItems[destDayItems.length - 1].order + 1000;
    } else {
      // If moving between items, get the actual surrounding items
      const prevItem = destDayItems[destination.index - 1];
      const nextItem = destDayItems[destination.index];
      newOrder = Math.floor((prevItem.order + nextItem.order) / 2);
    }

    // Create updated items array
    const updatedItems = currentItems.map(item => 
      item.id === movedItem.id
        ? { ...item, dayIndex: destDayIndex, order: newOrder }
        : item
    );

    // Normalize all days
    normalizeOrderPositions(updatedItems);
    
    // First update UI with locally recalculated times
    const localRecalculatedItems = agendaService.calculateItemTimes(updatedItems, eventStartTime);
    onReorder(localRecalculatedItems);
    
    // Update database and get recalculated items
    const finalItems = await updateDatabase('move', updatedItems);
    
    // Update UI again with server-recalculated items
    onReorder(finalItems);
  };

  // Add a new agenda item
  const addItem = async (
    newItem: Omit<AgendaItem, 'id' | 'startTime' | 'endTime' | 'order'>, 
    currentItems: AgendaItem[],
    afterOrder?: number
  ) => {
    // Get items in the same day
    const dayItems = currentItems
      .filter(i => i.dayIndex === newItem.dayIndex)
      .sort((a, b) => a.order - b.order);

    // Determine the appropriate order value
    let orderValue: number;
    if (afterOrder !== undefined) {
      if (afterOrder === 0 && dayItems.length > 0) {
        // Special case: inserting at the beginning of the day
        // Use a value smaller than the first item's order
        orderValue = dayItems[0].order > 500 ? dayItems[0].order - 500 : -500;
      } else {
        // Normal case: inserting after a specific position
        orderValue = afterOrder + 500;
      }
    } else {
      // Default: add to the end of the day
      orderValue = dayItems.reduce((max, item) => Math.max(max, item.order), 0) + 1000;
    }

    // Create complete item with generated id
    const completeItem: AgendaItem = {
      ...newItem,
      id: uuidv4(),
      startTime: '',
      endTime: '',
      order: orderValue
    };

    // Add new item to the array
    let newItems = [...currentItems, completeItem];

    // Normalize all days
    normalizeOrderPositions(newItems);

    // First update UI with locally recalculated times
    const localRecalculatedItems = agendaService.calculateItemTimes(newItems, eventStartTime);
    onReorder(localRecalculatedItems);
    
    // Update database and get recalculated items
    const updatedItems = await updateDatabase('add', newItems);
    
    // Update UI again with server-recalculated items
    onReorder(updatedItems);
    
    // Return the updated complete item with normalized order
    return updatedItems.find(i => i.id === completeItem.id) || completeItem;
  };

  // Update an existing agenda item
  const updateItem = async (
    itemId: string,
    updates: Partial<AgendaItem>,
    currentItems: AgendaItem[]
  ) => {
    // Find the item to update
    const existingItem = currentItems.find(i => i.id === itemId);
    if (!existingItem) {
      throw new Error('Item not found');
    }

    // Create new items array with the updated item
    let newItems = currentItems.map(item => 
      item.id === itemId
        ? { ...item, ...updates }
        : item
    );

    // Normalize all days
    normalizeOrderPositions(newItems);

    // Calculate times using the service
    const recalculatedItems = agendaService.calculateItemTimes(newItems, eventStartTime);

    // Update UI immediately
    onReorder(recalculatedItems);
    
    // Update database in background
    updateDatabase('update', recalculatedItems);
    
    return recalculatedItems.find(i => i.id === itemId)!;
  };

  return {
    isLoading,
    deleteItem,
    splitItem,
    moveItemInDay,
    moveItemToDay,
    handleDragEnd,
    addItem,
    updateItem,
  }
}

// Helper function to calculate new order
function calculateNewOrder(itemsOrDirection: AgendaItem[] | string, targetIndexOrCurrentOrder: number, allItems?: AgendaItem[]): number {
  // Handle directional moves
  if (typeof itemsOrDirection === 'string' && allItems) {
    const direction = itemsOrDirection;
    const currentOrder = targetIndexOrCurrentOrder;
    const dayItems = allItems.sort((a, b) => a.order - b.order);
    
    switch (direction) {
      case "up": {
        const prevItem = dayItems.find(i => i.order < currentOrder);
        return prevItem ? prevItem.order : currentOrder - 10;
      }
      case "down": {
        const nextItem = dayItems.find(i => i.order > currentOrder);
        return nextItem ? nextItem.order : currentOrder + 10;
      }
      case "top":
        return Math.min(...dayItems.map(i => i.order)) - 10;
      case "bottom":
        return Math.max(...dayItems.map(i => i.order)) + 10;
      default:
        throw new Error(`Invalid direction: ${direction}`);
    }
  }
  
  // Handle drag and drop
  const items = itemsOrDirection as AgendaItem[];
  const targetIndex = targetIndexOrCurrentOrder;
  
  if (items.length === 0) return 10;
  if (targetIndex === 0) return items[0].order - 10;
  if (targetIndex >= items.length) return items[items.length - 1].order + 10;
  return Math.floor((items[targetIndex - 1].order + items[targetIndex].order) / 2);
} 