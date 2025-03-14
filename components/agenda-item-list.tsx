"use client"

import { useState, useEffect } from "react"
import { Edit, Trash, GripVertical, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Clock, Plus, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase, type AgendaItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"

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
  onReorder: (items: AgendaItem[]) => void
  onAddAtPosition?: (dayIndex: number, afterOrder: number) => void
  adhereToTimeRestrictions?: boolean
}

export function AgendaItemList({ 
  items, 
  isLoading, 
  onEdit, 
  onReorder,
  onAddAtPosition,
  adhereToTimeRestrictions = true
}: AgendaItemListProps) {
  const [currentItems, setCurrentItems] = useState<AgendaItem[]>(items)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<AgendaItem | null>(null)
  const { toast } = useToast()
  const [listError, setListError] = useState<Error | string | null>(null)

  // Update local state when props change
  if (JSON.stringify(items) !== JSON.stringify(currentItems)) {
    setCurrentItems(items)
  }

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
    
    // Parse times
    const [startHrs, startMins] = item.startTime.split(':').map(Number);
    const [endHrs, endMins] = item.endTime.split(':').map(Number);
    
    // A reasonable default end time for a day's agenda
    const defaultEndTime = "17:00";
    const [defaultEndHrs, defaultEndMins] = defaultEndTime.split(':').map(Number);
    
    // Convert to minutes since midnight
    const endTimeInMins = endHrs * 60 + endMins;
    const defaultEndInMins = defaultEndHrs * 60 + defaultEndMins;
    
    // Check if end time exceeds the default end time
    return endTimeInMins > defaultEndInMins;
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
        duration: 5000
      });
    }
  }, [currentItems, adhereToTimeRestrictions, toast]);

  async function handleDeleteItem(id: string) {
    try {
      const { error } = await supabase.from("agenda_items").delete().eq("id", id)

      if (error) throw error

      // Update local state
      const updatedItems = currentItems.filter((item) => item.id !== id)
      setCurrentItems(updatedItems)

      // Get a reference item for recalculation
      const referenceItem = updatedItems[0];
      
      if (referenceItem) {
        // Trigger a recalculation to update times within each day (no cross-day movement)
        try {
          const response = await fetch('/api/agenda-items/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              item: {
                id: referenceItem.id,
                event_id: referenceItem.event_id,
                topic: referenceItem.topic,
                description: referenceItem.description || "",
                duration_minutes: referenceItem.durationMinutes,
                day_index: referenceItem.dayIndex,
                order_position: referenceItem.order,
                start_time: referenceItem.startTime,
                end_time: referenceItem.endTime
              },
              triggerFullRecalculation: false // Just recalculate times, don't move between days
            }),
          });
          
          if (!response.ok) {
            console.error("Error in recalculation after delete:", await response.json());
          }
        } catch (recalcError) {
          console.error("Failed to trigger recalculation:", recalcError);
        }
      }

      // Recalculate positions and times with proper spacing
      const reindexedItems = updatedItems.map((item) => {
        // Find all items in the same day
        const dayItems = updatedItems.filter((i) => i.dayIndex === item.dayIndex)
        // Sort them by order
        dayItems.sort((a, b) => a.order - b.order)
        // Find the index of this item in the day items
        const dayIndex = dayItems.findIndex((i) => i.id === item.id)

        return {
          ...item,
          order: dayIndex * 10, // Use increments of 10
        }
      })

      onReorder(reindexedItems)

      toast({
        title: "Item deleted",
        description: "The agenda item has been deleted successfully.",
      })
    } catch (error: any) {
      console.error("Error deleting item:", error)
      setListError(getErrorMessage(error))
    }
  }

  function handleDragEnd(result: any) {
    if (!result.destination) return

    const sourceDay = Number.parseInt(result.source.droppableId.split("-")[1])
    const destinationDay = Number.parseInt(result.destination.droppableId.split("-")[1])

    // Get all items for the source day
    const sourceDayItems = currentItems
      .filter((item) => item.dayIndex === sourceDay)
      .sort((a, b) => a.order - b.order)

    // Get the item being moved
    const [movedItem] = sourceDayItems.splice(result.source.index, 1)

    // If moving to a different day
    if (sourceDay !== destinationDay) {
      // Update the day index of the moved item
      movedItem.dayIndex = destinationDay

      // Get all items for the destination day
      const destinationDayItems = currentItems
        .filter((item) => item.dayIndex === destinationDay)
        .sort((a, b) => a.order - b.order)

      // Insert the moved item at the new position
      destinationDayItems.splice(result.destination.index, 0, movedItem)

      // Update positions for all items in the destination day
      destinationDayItems.forEach((item, index) => {
        item.order = index * 10;
      })

      // Combine all items: items from other days + updated source day items + updated destination day items
      const updatedItems = currentItems
        .filter((item) => item.dayIndex !== sourceDay && item.dayIndex !== destinationDay)
        .concat(sourceDayItems)
        .concat(destinationDayItems)

      // Update the UI immediately
      setCurrentItems(updatedItems)

      // Update positions and recalculate times
      onReorder(updatedItems)
    } else {
      // Moving within the same day
      // Insert the moved item at the new position
      sourceDayItems.splice(result.destination.index, 0, movedItem)

      // Update positions for all items in the day, using increments of 10 to leave gaps
      sourceDayItems.forEach((item, index) => {
        item.order = index * 10;
      })

      // Combine all items: items from other days + updated day items
      const updatedItems = currentItems.filter((item) => item.dayIndex !== sourceDay).concat(sourceDayItems)

      // Update the UI immediately
      setCurrentItems(updatedItems)

      // Update positions and recalculate times
      onReorder(updatedItems)
    }
  }

  function moveItem(item: AgendaItem, direction: "up" | "down" | "top" | "bottom") {
    // Get all items for this day
    const dayItems = currentItems.filter((i) => i.dayIndex === item.dayIndex).sort((a, b) => a.order - b.order)

    // Find the index of this item in the day items
    const index = dayItems.findIndex((i) => i.id === item.id)
    if (index === -1) return

    // Remove the item from its current position
    const [movedItem] = dayItems.splice(index, 1)

    // Determine the new position
    let newIndex
    switch (direction) {
      case "up":
        newIndex = Math.max(0, index - 1)
        break
      case "down":
        newIndex = Math.min(dayItems.length, index + 1)
        break
      case "top":
        newIndex = 0
        break
      case "bottom":
        newIndex = dayItems.length
        break
    }

    // Insert the item at the new position
    dayItems.splice(newIndex, 0, movedItem)

    // Update positions for all items in the day, using increments of 10
    dayItems.forEach((item, index) => {
      item.order = index * 10;
    })

    // Combine all items: items from other days + updated day items
    const updatedItems = currentItems.filter((i) => i.dayIndex !== item.dayIndex).concat(dayItems)

    // Update the UI immediately
    setCurrentItems(updatedItems)

    // Update positions and recalculate times
    onReorder(updatedItems)
  }

  function moveItemToDay(item: AgendaItem, direction: "previous" | "next") {
    // Calculate the target day index
    const targetDayIndex = direction === "previous" 
      ? Math.max(0, item.dayIndex - 1) 
      : item.dayIndex + 1;
    
    // If trying to move to previous day but already on first day, do nothing
    if (direction === "previous" && item.dayIndex === 0) {
      return;
    }
    
    // No need to check for maximum day index when moving forward
    // Users should be able to create a new day by moving an item forward
    
    // Get items for the target day
    const targetDayItems = currentItems.filter(i => i.dayIndex === targetDayIndex)
      .sort((a, b) => a.order - b.order);
    
    // Determine the new order position
    let newOrder: number;
    
    if (direction === "previous") {
      // When moving to previous day, place at the end
      if (targetDayItems.length > 0) {
        const lastItem = targetDayItems[targetDayItems.length - 1];
        newOrder = lastItem.order + 10;
      } else {
        newOrder = 0;
      }
    } else {
      // When moving to next day, place at the beginning
      if (targetDayItems.length > 0) {
        const firstItem = targetDayItems[0];
        newOrder = Math.max(0, firstItem.order - 10);
      } else {
        newOrder = 0;
      }
    }
    
    // Create a copy of the item with the new day index and order
    const updatedItem = {
      ...item,
      dayIndex: targetDayIndex,
      order: newOrder
    };
    
    // Update the items array
    const updatedItems = currentItems.map(i => 
      i.id === item.id ? updatedItem : i
    );
    
    // Update the UI
    setCurrentItems(updatedItems);
    
    // Trigger reordering to update the database
    onReorder(updatedItems);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-1/3 mb-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
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
      {sortedDays.map((dayIndex) => {
        const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order)

        return (
          <div key={dayIndex} className="space-y-4">
            <h2 className="text-xl font-semibold">Day {dayIndex + 1}</h2>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`day-${dayIndex}`}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {dayItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}>
                            <Card className={`relative ${adhereToTimeRestrictions && checkTimeExceeded(item) ? 'border-red-400' : ''}`}>
                              <div className="absolute left-0 top-0 bottom-0 flex items-center px-2 text-muted-foreground">
                                <div {...provided.dragHandleProps} className="cursor-grab">
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
                                      onClick={() => moveItemToDay(item, "previous")}
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
                                      onClick={() => moveItem(item, "top")}
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
                                      onClick={() => moveItem(item, "up")}
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
                                      onClick={() => moveItem(item, "down")}
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
                                      onClick={() => moveItem(item, "bottom")}
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
                                      onClick={() => moveItemToDay(item, "next")}
                                      disabled={false} // Allow moving to next day always
                                      title="Move to next day"
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span className="sr-only">Move to next day</span>
                                    </Button>
                                    
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
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="h-7 w-7 rounded-full border-[1px] border-gray-400 dark:border-gray-600"
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
                            {onAddAtPosition && (index < dayItems.length - 1) && (
                              <div 
                                className="flex items-center justify-center my-2 group cursor-pointer"
                                onClick={() => {
                                  // Calculate the midpoint between current item and next item
                                  const currentOrder = item.order;
                                  const nextOrder = dayItems[index + 1].order;
                                  const midpointOrder = Math.floor((currentOrder + nextOrder) / 2);
                                  onAddAtPosition(dayIndex, midpointOrder);
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
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    
                    {onAddAtPosition && dayItems.length > 0 && (
                      <div 
                        className="flex items-center justify-center mt-2 group cursor-pointer"
                        onClick={() => onAddAtPosition(dayIndex, (dayItems[dayItems.length - 1].order + 10))}
                      >
                        <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                        <div className="mx-2 p-1 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="flex-grow border-t border-dashed group-hover:border-primary/50"></div>
                      </div>
                    )}
                    
                    {onAddAtPosition && dayItems.length === 0 && (
                      <div 
                        className="flex items-center justify-center my-4 cursor-pointer"
                        onClick={() => onAddAtPosition(dayIndex, 0)}
                      >
                        <Button variant="outline" className="flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          Add first item for Day {dayIndex + 1}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )
      })}
      <ErrorDialog title="Agenda Item Error" error={listError} onClose={() => setListError(null)} />
    </div>
  )
}

