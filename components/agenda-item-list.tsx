"use client"

import { useState } from "react"
import { Edit, Trash, GripVertical, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase, type AgendaItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { ErrorDialog } from "@/components/error-dialog"
import { getErrorMessage } from "@/lib/error-utils"

interface AgendaItemListProps {
  items: AgendaItem[]
  isLoading: boolean
  onEdit: (item: AgendaItem) => void
  onReorder: (items: AgendaItem[]) => void
}

export function AgendaItemList({ items, isLoading, onEdit, onReorder }: AgendaItemListProps) {
  const [currentItems, setCurrentItems] = useState<AgendaItem[]>(items)
  const { toast } = useToast()
  const [listError, setListError] = useState<Error | string | null>(null)

  // Update local state when props change
  if (JSON.stringify(items) !== JSON.stringify(currentItems)) {
    setCurrentItems(items)
  }

  async function handleDeleteItem(id: string) {
    try {
      const { error } = await supabase.from("agenda_items").delete().eq("id", id)

      if (error) throw error

      // Update local state
      const updatedItems = currentItems.filter((item) => item.id !== id)
      setCurrentItems(updatedItems)

      // Recalculate positions and times
      const reindexedItems = updatedItems.map((item, index) => {
        // Find all items in the same day
        const dayItems = updatedItems.filter((i) => i.dayIndex === item.dayIndex)
        // Sort them by order
        dayItems.sort((a, b) => a.order - b.order)
        // Find the index of this item in the day items
        const dayIndex = dayItems.findIndex((i) => i.id === item.id)

        return {
          ...item,
          order: dayIndex,
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
        item.order = index
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

      // Update positions for all items in the day
      sourceDayItems.forEach((item, index) => {
        item.order = index
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

    // Update positions for all items in the day
    dayItems.forEach((item, index) => {
      item.order = index
    })

    // Combine all items: items from other days + updated day items
    const updatedItems = currentItems.filter((i) => i.dayIndex !== item.dayIndex).concat(dayItems)

    // Update the UI immediately
    setCurrentItems(updatedItems)

    // Update positions and recalculate times
    onReorder(updatedItems)
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
                            <Card className="relative">
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
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveItem(item, "top")}
                                      disabled={index === 0}
                                    >
                                      <ChevronsUp className="h-4 w-4" />
                                      <span className="sr-only">Move to top</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveItem(item, "up")}
                                      disabled={index === 0}
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                      <span className="sr-only">Move up</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveItem(item, "down")}
                                      disabled={index === dayItems.length - 1}
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                      <span className="sr-only">Move down</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveItem(item, "bottom")}
                                      disabled={index === dayItems.length - 1}
                                    >
                                      <ChevronsDown className="h-4 w-4" />
                                      <span className="sr-only">Move to bottom</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                                      <Edit className="h-4 w-4" />
                                      <span className="sr-only">Edit</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)}>
                                      <Trash className="h-4 w-4" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pl-10">
                                <div className="flex justify-between text-sm">
                                  <div>
                                    <span className="font-medium">Duration:</span> {item.durationMinutes} minutes
                                  </div>
                                  <div>
                                    <span className="font-medium">Time:</span> {item.startTime} - {item.endTime}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            {index < dayItems.length - 1 && (
                              <div className="flex items-center justify-center my-2">
                                <div className="w-full border-t border-dashed"></div>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
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

