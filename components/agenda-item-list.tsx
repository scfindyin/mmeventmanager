"use client"

import { useState, useEffect, Fragment, useRef } from "react"
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
}

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
  eventStartTime
}: AgendaItemListProps) {
  const [currentItems, setCurrentItems] = useState<AgendaItem[]>(items)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<AgendaItem | null>(null)
  const { toast } = useToast()
  const [listError, setListError] = useState<Error | string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement>>({})
  
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

  // Combine loading states
  const isLoading = isLoadingProp || isOperationLoading

  // Function to scroll an item into view
  const scrollItemIntoView = (itemId: string) => {
    setTimeout(() => {
      const element = itemRefs.current[itemId]
      if (element) {
        console.log("Scrolling item into view:", itemId)
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  // Check for items exceeding time limits and show a toast notification
  useEffect(() => {
    if (!adhereToTimeRestrictions || currentItems.length === 0) return;
    
    // Find any items that exceed their day's time limit
    const exceededItems = currentItems.filter(item => checkTimeExceeded(item));
    
    if (exceededItems.length > 0) {
      // Get the day numbers (1-indexed for user display)
      const dayNumbers = [...new Set(exceededItems.map(item => item.dayIndex + 1))].sort();
      
      // Create a user-friendly message
      let message = "";
      if (dayNumbers.length === 1) {
        message = `Day ${dayNumbers[0]} has ${exceededItems.length} item${exceededItems.length > 1 ? 's' : ''} that exceed${exceededItems.length === 1 ? 's' : ''} the day's time limit.`;
      } else {
        message = `Days ${dayNumbers.join(', ')} have items that exceed their time limits.`;
      }
      
      // Show toast with extended duration (5 seconds = 5000ms)
      toast({
        title: "Time limit exceeded",
        description: message,
        variant: "destructive",
        duration: 3500
      });
    }
  }, [currentItems, adhereToTimeRestrictions, toast]);

  // Add initial load recalculation
  useEffect(() => {
    if (items.length > 0 && !isLoading) {
      // DEBUG MODE: Skip database calls
      console.log("DEBUG: Skipping database initialization in AgendaItemList");
      
      // Just calculate times locally
      const updatedItems = agendaService.calculateItemTimes(items, eventStartTime);
      setCurrentItems(updatedItems);
      onReorder(updatedItems);
    }
  }, []) // Empty dependency array means this runs once on mount

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

      // Update both items
      await splitItem(item, newItem, currentItems);
      return true;
    } catch (error) {
      return false;
    }
  }

  const handleMoveItem = async (item: AgendaItem, direction: "up" | "down" | "top" | "bottom") => {
    try {
      await moveItemInDay(item, direction, currentItems)
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
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  const handleDragEnd = async (result: any) => {
    try {
      await handleDragEndOp(result, currentItems)
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

  if (currentItems.length === 0) {
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
    <div className="space-y-8">
      <DragDropContext
        data-testid="drag-drop-context"
        onDragEnd={handleDragEnd}
      >
      {Array.from({ length: totalDays || Math.max(...Object.keys(itemsByDay).map(Number)) + 1 }).map((_, dayIndex) => {
        const dayItems = itemsByDay[dayIndex]?.sort((a, b) => a.order - b.order) || [];

        return (
          <div key={dayIndex} className="space-y-2">
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold flex items-center">
                  <span>Day {dayIndex + 1}</span>
                </h2>
                {onAddAtPosition && (
                  <div 
                    className="flex items-center justify-center my-2 group cursor-pointer"
                    onClick={() => handleAddAtPosition(dayIndex, 0)}
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
                    }`}
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
                              <Card className={`relative transition-all duration-300 ${
                                adhereToTimeRestrictions && checkTimeExceeded(item) 
                                  ? 'border-red-400' 
                                  : snapshot.isDragging 
                                    ? 'border-primary ring-2 ring-primary/20' 
                                    : ''
                              }`}>
                              <div className="absolute left-0 top-0 bottom-0 flex items-center px-2 text-muted-foreground">
                                  <div 
                                    {...provided.dragHandleProps} 
                                    className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
                                    title="Drag to reorder or move between days"
                                  >
                                  <GripVertical className="h-5 w-5" />
                                </div>
                              </div>
                              <CardHeader className="pb-2 pl-10">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg">{item.topic}</CardTitle>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItemToDay(item, "previous")}
                                      disabled={item.dayIndex === 0}
                                      title="Move to previous day"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to previous day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItem(item, "top")}
                                      disabled={index === 0}
                                      title="Move to top of day"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronsUp className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to top of day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItem(item, "up")}
                                      disabled={index === 0}
                                      title="Move up one item"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronUp className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move up one item</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItem(item, "down")}
                                      disabled={index === dayItems.length - 1}
                                      title="Move down one item"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move down one item</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItem(item, "bottom")}
                                      disabled={index === dayItems.length - 1}
                                      title="Move to bottom of day"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <ChevronsDown className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to bottom of day</span>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleMoveItemToDay(item, "next")}
                                        disabled={typeof totalDays === 'number' && (item.dayIndex + 1) >= totalDays}
                                      title="Move to next day"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to next day</span>
                                    </Button>
                                    
                                    <div className="w-[25px]"></div>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => onEdit(item)}
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      <span className="sr-only">Edit</span>
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleSplitItem(item)}
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                      title="Split this item into two"
                                    >
                                      <CopyPlus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Split</span>
                                    </Button>
                                    
                                    <Button 
                                      variant="outline" 
                                      size="icon" 
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                      title="Delete item"
                                    >
                                      <Trash className="h-3.5 w-3.5" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pl-10">
                                <div className="flex justify-between text-sm">
                                  <div>
                                    <span className="font-medium">Duration:</span> {formatDuration(item.durationMinutes)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Time:</span> {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)}
                                    {adhereToTimeRestrictions && checkTimeExceeded(item) && (
                                      <span className="ml-2 text-xs text-red-500 font-medium">
                                        Exceeds time limit
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                                    {item.description}
                                  </p>
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
                                onClick={() => {
                                  // Calculate the midpoint between current item and next item
                                  const currentOrder = item.order;
                                  const nextOrder = dayItems[index + 1].order;
                                  const midpointOrder = Math.floor((currentOrder + nextOrder) / 2);
                                  handleAddAtPosition(dayIndex, midpointOrder);
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
                            onClick={() => {
                              // Add after the last item
                              const lastOrder = item.order;
                              const newOrder = lastOrder + 1000; // Add with significant gap after last item
                              handleAddAtPosition(dayIndex, newOrder);
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

