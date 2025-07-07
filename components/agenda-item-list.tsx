"use client"

import { useState, useEffect, Fragment, useRef, useCallback } from "react"
import { Edit, Trash, GripVertical, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Clock, Plus, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Minus, CopyPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { AgendaItem } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"
import { printTypeInfo, ensureNumber } from "@/lib/debug-utils"
import { v4 as uuidv4 } from "uuid"
import { recalculateAgendaTimes } from "@/lib/agenda-recalculation"
import { agendaService } from "@/lib/services/agenda-service"
import { useAgendaOperations } from "@/hooks/use-agenda-operations"
import { format, addDays } from "date-fns"
import { RichTextDisplay } from "@/components/rich-text-display"

// Helper function to format time in 12-hour format
function formatTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  
  if (isNaN(hour)) return time24;
  
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  return `${hour12}:${minuteStr}${period}`;
}

interface AgendaItemListProps {
  items: AgendaItem[]
  isLoading: boolean
  onEdit: (item: AgendaItem) => void
  onReorder: (items: AgendaItem[], skipRefresh?: boolean) => void
  onAddAtPosition?: (dayIndex: number, afterOrder: number) => void
  adhereToTimeRestrictions?: boolean
  totalDays?: number
  scrollToItemId?: string | null
  onItemScrolled?: () => void
  eventEndTime: string
  eventStartTime: string
  eventStartDate?: string
  timeIncrementMinutes?: number
}

interface ApiResponse {
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
  is_filler: boolean;
}

// Additional utility for handling problematic button clicks
const useSafeButtonClick = () => {
  const handleSafeSplit = (e: React.MouseEvent, callback: () => any) => {
    // Prevent default behavior and stop propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Save the current scroll position
    const scrollPos = window.scrollY;
    
    // Execute in a setTimeout to break event chain
    setTimeout(async () => {
      try {
        // Wrap the callback in Promise.resolve to handle both Promise and non-Promise returns
        await Promise.resolve(callback());
        // Restore scroll position after a small delay
        setTimeout(() => window.scrollTo(0, scrollPos), 0);
      } catch (err) {
        console.error("Error in button operation:", err);
        // Still restore scroll position
        setTimeout(() => window.scrollTo(0, scrollPos), 0);
      }
    }, 0);
  };
  
  return { handleSafeSplit };
};

export function AgendaItemList({ 
  items, 
  isLoading: isLoadingProp, 
  onEdit, 
  onReorder,
  onAddAtPosition,
  adhereToTimeRestrictions = true,
  totalDays,
  scrollToItemId,
  onItemScrolled,
  eventEndTime,
  eventStartTime,
  eventStartDate,
  timeIncrementMinutes = 15
}: AgendaItemListProps) {
  const [currentItems, setCurrentItems] = useState<AgendaItem[]>(items)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<AgendaItem | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const { toast } = useToast()
  const [listError, setListError] = useState<Error | string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement>>({})
  
  // Use our utility for safe button operations
  const { handleSafeSplit } = useSafeButtonClick();
  
  // Use our new hook with all operations
  const {
    isLoading: isOperationLoading,
    deleteItem,
    splitItem,
    moveItemInDay,
    moveItemToDay: moveItemToDayOp,
    handleDragEnd: handleDragEndOp,
    addItem,
    updateItem
  } = useAgendaOperations({
    onReorder: (items) => {
      setCurrentItems(items)
      onReorder(items)
    },
    toast,
    eventStartTime
  })

  // Handle item selection
  const handleSelectItem = (itemId: string) => {
    const newSelectedId = selectedItemId === itemId ? null : itemId;
    setSelectedItemId(newSelectedId);
    
    // If selecting an item (not deselecting), scroll it into view
    if (newSelectedId) {
      scrollItemIntoView(newSelectedId);
    }
  }

  // Combine loading states
  const isLoading = isLoadingProp || isOperationLoading

  // Function to scroll an item into view
  const scrollItemIntoView = (itemId: string) => {
    setTimeout(() => {
      const element = itemRefs.current[itemId]
      if (element) {
        console.log("Scrolling item into view:", itemId)
        // Use scrollIntoView with different options
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        // Notify parent that we've scrolled
        if (onItemScrolled) onItemScrolled()
      }
    }, 100) // Small delay to ensure the DOM has updated
  }

  // Effect to scroll to the item specified by the scrollToItemId prop
  useEffect(() => {
    if (scrollToItemId) {
      scrollItemIntoView(scrollToItemId)
    }
  }, [scrollToItemId])

  // Update local state when props change
  useEffect(() => {
    if (JSON.stringify(items) !== JSON.stringify(currentItems)) {
      // Ensure no duplicate items by filtering by unique IDs
      const uniqueItems = items.filter((item, index, self) => 
        index === self.findIndex(i => i.id === item.id)
      )
      setCurrentItems(uniqueItems)
    }
  }, [items, currentItems])

  // Function to format duration in hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} minutes`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    }
  };

  // Function to check if an item exceeds time boundaries
  const checkTimeExceeded = (item: AgendaItem): boolean => {
    if (!adhereToTimeRestrictions || !item.startTime || !item.endTime) return false;
    
    if (!eventEndTime) {
      console.error("Cannot check time exceeded: eventEndTime is required");
      return false;
    }
    
    // Parse times
    const [startHrs, startMins] = item.startTime.split(':').map(Number);
    const [endHrs, endMins] = item.endTime.split(':').map(Number);
    
    // Use the event's end time from props with no fallback
    const [defaultEndHrs, defaultEndMins] = eventEndTime.split(':').map(Number);
    
    // Convert to minutes since midnight
    const endTimeInMins = endHrs * 60 + endMins;
    const defaultEndInMins = defaultEndHrs * 60 + defaultEndMins;
    
    // Check if end time exceeds the default end time
    const exceeds = endTimeInMins > defaultEndInMins;
    
    // Log for debugging
    if (exceeds) {
      console.log(`Item ${item.topic} on day ${item.dayIndex + 1} exceeds time limit: ${item.endTime} > ${eventEndTime}`);
    }
    
    return exceeds;
  };

  // Wrapper functions to handle errors and UI updates
  const handleDeleteItem = async (id: string) => {
    try {
      const item = currentItems.find(item => item.id === id)
      if (!item) {
        throw new Error('Item not found')
      }
      await deleteItem(item, currentItems)
    } catch (error) {
      setListError(getErrorMessage(error))
    }
  }

  const handleSplitItem = async (item: AgendaItem) => {
    try {
      // Save current scroll position
      const scrollPos = window.scrollY;
      
      // Calculate the order position for the new item
      const itemsInDay = currentItems.filter(i => i.dayIndex === item.dayIndex);
      const currentIndex = itemsInDay.findIndex(i => i.id === item.id);
      const nextItem = itemsInDay[currentIndex + 1];
      const newOrder = nextItem 
        ? item.order + (nextItem.order - item.order) / 2 
        : item.order + 1000;

      // Create an exact copy with new ID and order
      const newItem = {
        ...item,
        id: uuidv4(),
        order: newOrder
      };

      // Update both items and get the IDs
      const result = await splitItem(item, newItem, currentItems);
      
      // Restore the scroll position to prevent jumping to top
      setTimeout(() => {
        window.scrollTo(0, scrollPos);
      }, 0);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  const handleMoveItem = async (item: AgendaItem, direction: "up" | "down" | "top" | "bottom") => {
    try {
      await moveItemInDay(item, direction, currentItems)
      // After moving, scroll the item into view
      setTimeout(() => scrollItemIntoView(item.id), 100)
    } catch (error) {
      setListError(getErrorMessage(error))
    }
  }

  const handleMoveItemToDay = async (item: AgendaItem, direction: "previous" | "next") => {
    try {
      // Find items in the target day
      const targetDayIndex = direction === "next" ? item.dayIndex + 1 : item.dayIndex - 1;
      const targetDayItems = currentItems.filter(i => i.dayIndex === targetDayIndex);
      
      // Calculate new order position based on direction
      let newOrder;
      if (direction === "next") {
        // Place at start of next day - before the first item or at 0 if empty
        newOrder = targetDayItems.length > 0 
          ? targetDayItems[0].order - 1000 
          : 0;
      } else {
        // Place at end of previous day - after the last item or at 1000 if empty
        newOrder = targetDayItems.length > 0 
          ? targetDayItems[targetDayItems.length - 1].order + 1000 
          : 1000;
      }
      
      // Create updated item with new day and order
      const updatedItem = {
        ...item,
        dayIndex: targetDayIndex,
        order: newOrder
      };
      
      await moveItemToDayOp(updatedItem, direction, currentItems, totalDays);
      // After moving to another day, scroll the item into view
      setTimeout(() => scrollItemIntoView(item.id), 100)
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  // Memoize the event handlers to prevent dependency array issues
  const memoizedHandleMove = useCallback((item: AgendaItem, direction: "up" | "down" | "top" | "bottom") => {
    handleMoveItem(item, direction);
  }, [handleMoveItem]);

  const memoizedHandleMoveToDay = useCallback((item: AgendaItem, direction: "previous" | "next") => {
    handleMoveItemToDay(item, direction);
  }, [handleMoveItemToDay]);

  const memoizedUpdateItem = useCallback((itemId: string, updates: Partial<AgendaItem>, currentItems: AgendaItem[]) => {
    return updateItem(itemId, updates, currentItems);
  }, [updateItem]);

  // Handle keyboard navigation
  useEffect(() => {
    // Only add keyboard listener if we have a selected item
    if (!selectedItemId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItemId) return;

      // Find the selected item and its index
      const selectedItem = currentItems.find(item => item.id === selectedItemId);
      if (!selectedItem) return;

      // Find items in the same day
      const dayItems = currentItems
        .filter(item => item.dayIndex === selectedItem.dayIndex)
        .sort((a, b) => a.order - b.order);
      
      const currentIndex = dayItems.findIndex(item => item.id === selectedItemId);
      if (currentIndex === -1) return;

      // Handle arrow keys
      switch (e.key) {
        case 'ArrowUp':
          if (currentIndex > 0) {
            e.preventDefault();
            memoizedHandleMove(selectedItem, "up");
          }
          break;
        case 'ArrowDown':
          if (currentIndex < dayItems.length - 1) {
            e.preventDefault();
            memoizedHandleMove(selectedItem, "down");
          }
          break;
        case 'ArrowLeft':
          // Subtract time increment from duration (minimum 5 minutes)
          e.preventDefault();
          const newDurationDecrease = Math.max(5, selectedItem.durationMinutes - timeIncrementMinutes);
          if (newDurationDecrease !== selectedItem.durationMinutes) {
            memoizedUpdateItem(selectedItem.id, { durationMinutes: newDurationDecrease }, currentItems);
          }
          break;
        case 'ArrowRight':
          // Add time increment to duration
          e.preventDefault();
          const newDurationIncrease = selectedItem.durationMinutes + timeIncrementMinutes;
          memoizedUpdateItem(selectedItem.id, { durationMinutes: newDurationIncrease }, currentItems);
          break;
        case 'PageUp':
          if (selectedItem.dayIndex > 0) {
            e.preventDefault();
            memoizedHandleMoveToDay(selectedItem, "previous");
          }
          break;
        case 'PageDown':
          if (typeof totalDays !== 'number' || (selectedItem.dayIndex + 1) < totalDays) {
            e.preventDefault();
            memoizedHandleMoveToDay(selectedItem, "next");
          }
          break;
        case 'Home':
          if (currentIndex > 0) {
            e.preventDefault();
            memoizedHandleMove(selectedItem, "top");
          }
          break;
        case 'End':
          if (currentIndex < dayItems.length - 1) {
            e.preventDefault();
            memoizedHandleMove(selectedItem, "bottom");
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, currentItems, totalDays, memoizedHandleMove, memoizedHandleMoveToDay, memoizedUpdateItem]);

  const handleDragEnd = async (result: any) => {
    try {
      // Prevent default browser behavior
      if (result.destination) {
        // Don't scroll to the top after drag ends
        setTimeout(() => window.scrollTo(0, window.scrollY), 0);
      }
      
      await handleDragEndOp(result, currentItems)
      
      // After dragging, scroll the dragged item into view with different behavior
      if (result.destination && result.draggableId) {
        setTimeout(() => {
          const element = itemRefs.current[result.draggableId];
          if (element) {
            // Use different scroll options that don't reset overall page position
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 100)
      }
    } catch (error) {
      setListError(getErrorMessage(error))
    }
  }

  // Function to handle adding an item at a specific position
  const handleAddAtPosition = async (dayIndex: number, afterOrder: number) => {
    if (onAddAtPosition) {
      try {
        // Simply call the parent's function to handle item creation
        onAddAtPosition(dayIndex, afterOrder);
      } catch (error) {
        setListError(getErrorMessage(error));
      }
    }
  }

  // Function to handle editing an item
  const handleEditItem = async (item: AgendaItem, updates: Partial<AgendaItem>) => {
    try {
      await updateItem(item.id, updates, currentItems);
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  // Function to format the date for each day
  const formatDayDate = (dayIndex: number) => {
    if (!eventStartDate) return null;
    
    try {
      const startDate = new Date(eventStartDate);
      const currentDate = addDays(startDate, dayIndex);
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } catch (error) {
      console.error("Error formatting day date:", error);
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-1/3 mb-2" data-testid="skeleton" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" data-testid="skeleton" />
              <Skeleton className="h-4 w-2/3" data-testid="skeleton" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (currentItems.length === 0 && (!totalDays || totalDays <= 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">No agenda items yet</h2>
        <p className="text-muted-foreground mt-1">Add your first agenda item to get started.</p>
      </div>
    )
  }

  // Group items by day
  const itemsByDay: Record<number, AgendaItem[]> = {}
  currentItems.forEach((item) => {
    if (!itemsByDay[item.dayIndex]) {
      itemsByDay[item.dayIndex] = []
    }
    itemsByDay[item.dayIndex].push(item)
  })

  // Sort days
  const sortedDays = Object.keys(itemsByDay)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-8 agenda-item-list">
      <DragDropContext
        data-testid="drag-drop-context"
        onDragEnd={handleDragEnd}
      >
      {Array.from({ length: totalDays || Math.max(...Object.keys(itemsByDay).map(Number), 0) + 1 }).map((_, dayIndex) => {
        const dayItems = itemsByDay[dayIndex]?.sort((a, b) => a.order - b.order) || [];
        const formattedDate = formatDayDate(dayIndex);

        return (
          <div key={dayIndex} className="space-y-2">
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold flex items-center px-4 py-2 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-md">
                  <span className="mr-2">Day {dayIndex + 1}</span>
                  {formattedDate && (
                    <>
                      <span> - {formattedDate}</span>
                    </>
                  )}
                </h2>
                {onAddAtPosition && (
                  <div 
                    className="flex items-center justify-center my-2 group cursor-pointer"
                    onClick={(e) => {
                      handleSafeSplit(e, () => handleAddAtPosition(dayIndex, 0));
                    }}
                  >
                    <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                    <div className="mx-2 p-1 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                      <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                  </div>
                )}
              </div>

              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    className={`space-y-4 transition-all duration-300 ${
                      snapshot.isDraggingOver 
                        ? 'bg-primary/10 border-2 border-dashed border-primary/50' 
                        : 'border-2 border-dashed border-transparent'
                    } ${dayItems.length === 0 ? 'min-h-[80px]' : ''}`}
                  >
                    {dayItems.map((item, index) => (
                      <Fragment key={item.id}>
                        <Draggable draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div 
                              ref={(el) => {
                                // Store reference in both the Draggable ref and our itemRefs
                                provided.innerRef(el);
                                if (el) itemRefs.current[item.id] = el;
                              }}
                              {...provided.draggableProps}
                              className={`transition-all ${
                                snapshot.isDragging 
                                  ? 'shadow-lg rotate-1 scale-105 z-10' 
                                  : ''
                              }`}
                            >
                              <Card 
                                className={`relative transition-all duration-300 shadow-md hover:shadow-lg dark:shadow-[2px_4px_16px_rgba(0,0,0,0.6),-1px_-1px_10px_rgba(130,180,255,0.4)] cursor-pointer ${
                                  adhereToTimeRestrictions && checkTimeExceeded(item) 
                                    ? 'border-red-400 bg-red-50/25 dark:bg-red-950/5' 
                                    : selectedItemId === item.id
                                      ? 'border-l-[5px] border-l-primary pl-1 bg-primary/5' 
                                      : snapshot.isDragging 
                                        ? 'border-primary ring-2 ring-primary/20' 
                                        : 'border-l-transparent border-l-[5px]'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  // Don't trigger selection when clicking buttons or drag handle
                                  if ((e.target as HTMLElement).closest('button') || 
                                      (e.target as HTMLElement).closest('[data-drag-handle]')) {
                                    return;
                                  }
                                  handleSelectItem(item.id);
                                }}
                              >
                              <div className="absolute left-0 top-0 bottom-0 flex items-center px-2 text-muted-foreground">
                                  <div 
                                    {...provided.dragHandleProps}
                                    data-drag-handle="true"
                                    className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
                                    title="Drag to reorder or move between days"
                                  >
                                  <GripVertical className="h-5 w-5" />
                                </div>
                              </div>
                              <CardHeader className="pb-2 pl-10">
                                <div className="flex items-start justify-between">
                                  <CardTitle className="text-lg mr-4">{item.topic}</CardTitle>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItemToDay(item, "previous");
                                      }}
                                      disabled={item.dayIndex === 0}
                                      title="Move to previous day"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to previous day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItem(item, "top");
                                      }}
                                      disabled={index === 0}
                                      title="Move to top of day"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronsUp className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to top of day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItem(item, "up");
                                      }}
                                      disabled={index === 0}
                                      title="Move up one item"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move up one item</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItem(item, "down");
                                      }}
                                      disabled={index === dayItems.length - 1}
                                      title="Move down one item"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move down one item</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItem(item, "bottom");
                                      }}
                                      disabled={index === dayItems.length - 1}
                                      title="Move to bottom of day"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronsDown className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to bottom of day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleMoveItemToDay(item, "next");
                                      }}
                                      disabled={typeof totalDays === 'number' && (item.dayIndex + 1) >= totalDays}
                                      title="Move to next day"
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to next day</span>
                                    </Button>
                                    
                                    <div className="w-[25px]"></div>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEdit(item);
                                      }}
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      <span className="sr-only">Edit</span>
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSafeSplit(e, () => handleSplitItem(item));
                                      }}
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                      title="Split this item into two"
                                    >
                                      <CopyPlus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Split</span>
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteItem(item.id);
                                      }}
                                      className="h-7 w-7 hover:h-7.5 hover:w-7.5 transform hover:scale-110 transition-all rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                      title="Delete item"
                                    >
                                      <Trash className="h-3.5 w-3.5" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pl-10">
                                <div className="text-sm">
                                  {formatDuration(item.durationMinutes)} from {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)}
                                  {adhereToTimeRestrictions && checkTimeExceeded(item) && (
                                    <span className="ml-2 text-xs text-red-500 font-medium">
                                      Exceeds time limit
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <div className="text-sm text-muted-foreground mt-2">
                                    <RichTextDisplay 
                                      content={item.description}
                                      className="text-sm text-muted-foreground"
                                    />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                            </div>
                          )}
                        </Draggable>
                        
                        {/* Add the "add between items" component after each item except the last one */}
                            {onAddAtPosition && (index < dayItems.length - 1) && (
                              <div 
                                className="flex items-center justify-center my-2 group cursor-pointer"
                                onClick={(e) => {
                                  handleSafeSplit(e, () => {
                                    // Calculate the midpoint between current item and next item
                                    const currentOrder = item.order;
                                    const nextOrder = dayItems[index + 1].order;
                                    const midpointOrder = Math.floor((currentOrder + nextOrder) / 2);
                                    handleAddAtPosition(dayIndex, midpointOrder);
                                  });
                                }}
                              >
                                <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                                <div className="mx-2 p-1 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                                  <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                </div>
                                <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                              </div>
                            )}
                        
                        {/* Add separator after the last item of a day */}
                        {onAddAtPosition && (index === dayItems.length - 1) && (
                          <div 
                            className="flex items-center justify-center my-2 group cursor-pointer"
                            onClick={(e) => {
                              handleSafeSplit(e, () => {
                                // Add after the last item
                                const lastOrder = item.order;
                                const newOrder = lastOrder + 1000; // Add with significant gap after last item
                                handleAddAtPosition(dayIndex, newOrder);
                              });
                            }}
                          >
                            <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                            <div className="mx-2 p-1 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                              <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </div>
                            <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                          </div>
                        )}
                      </Fragment>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
          </div>
        )
      })}
      </DragDropContext>
      <ErrorDialog title="Agenda Item Error" error={listError} onClose={() => setListError(null)} />
    </div>
  )
}

