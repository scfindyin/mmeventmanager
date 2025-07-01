"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { format, addMinutes, parseISO, differenceInDays } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { AgendaItem } from "./agenda-item"
import { AgendaItemForm } from "./agenda-item-form"
import { type Event, type AgendaItem as AgendaItemType } from "@/lib/types"
import { calculateAgendaTimes } from "@/lib/agenda-calculator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { dbStringToDate } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabase"

interface AgendaTimelineProps {
  event: Event
  onEventUpdate: (event: Event) => void
}

export function AgendaTimeline({ event, onEventUpdate }: AgendaTimelineProps) {
  const [showNewItemForm, setShowNewItemForm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0)

  // Calculate the days in the event
  const eventDays = (() => {
    if (!event.startDate || !event.endDate) return []

    const startDate = parseISO(event.startDate)
    const endDate = parseISO(event.endDate)
    const dayCount = differenceInDays(endDate, startDate) + 1

    const days = []
    for (let i = 0; i < dayCount; i++) {
      const date = addMinutes(startDate, i * 24 * 60)
      days.push({
        date,
        dayIndex: i,
        formattedDate: format(date, "EEEE, MMMM d, yyyy"),
      })
    }

    return days
  })()

  // Set the active day to the first day when the component mounts
  useEffect(() => {
    if (eventDays.length > 0 && activeDayIndex === undefined) {
      setActiveDayIndex(0)
    }
  }, [eventDays, activeDayIndex])

  // Get agenda items for the active day
  const activeItems = event?.agendaItems?.filter((item) => item.dayIndex === activeDayIndex) || []

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !event.agendaItems) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index
    
    if (sourceIndex === destinationIndex) return

    // Create a new array of agenda items
    const updatedItems = [...event.agendaItems]

    // Find all items for the active day
    const activeDayItems = updatedItems.filter((item) => item.dayIndex === activeDayIndex)

    // Get the item being moved
    const [movedItem] = activeDayItems.splice(sourceIndex, 1)

    // Insert the dragged item at the new position
    activeDayItems.splice(destinationIndex, 0, movedItem)

    // Update the order of all items for the active day
    const reorderedItems = activeDayItems.map((item, index) => ({
      ...item,
      order: index,
    }))

    // Combine with items from other days
    const newAgendaItems = updatedItems
      .filter((item) => item.dayIndex !== activeDayIndex)
      .concat(reorderedItems)

    // Recalculate times
    try {
      const recalculatedItems = calculateAgendaTimes({
        ...event,
        agendaItems: newAgendaItems,
      })

      // Update the event
      onEventUpdate({
        ...event,
        agendaItems: recalculatedItems,
      })
    } catch (error) {
      console.error('Error in calculateAgendaTimes:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        eventData: {
          itemCount: newAgendaItems.length,
          items: newAgendaItems.map(item => ({ id: item.id, dayIndex: item.dayIndex, order: item.order }))
        }
      })
      // Re-throw to preserve the error for the error boundary
      throw error
    }
  }

  const handleAddItemAtPosition = (position: number) => {
    if (!event.agendaItems) return

    // Create a new item
    const newItem: AgendaItemType = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      event_id: event.id,
      topic: "New Item",
      description: "",
      durationMinutes: 30,
      dayIndex: activeDayIndex,
      order: position,
      startTime: "", // Will be calculated
      endTime: "", // Will be calculated
    }

    // If inserting at a position, increment the order of all items after it
    const updatedItems = event.agendaItems.map(item => {
      if (item.dayIndex === activeDayIndex && item.order >= position) {
        return { ...item, order: item.order + 1 }
      }
      return item
    })

    // Add the new item
    const itemsWithNew = [...updatedItems, newItem]

    // Recalculate times
    try {
      const recalculatedItems = calculateAgendaTimes({
        ...event,
        agendaItems: itemsWithNew,
      })

      // Update the event
      onEventUpdate({
        ...event,
        agendaItems: recalculatedItems,
      })
    } catch (error) {
      console.error('Error in calculateAgendaTimes:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        eventData: {
          itemCount: itemsWithNew.length,
          items: itemsWithNew.map(item => ({ id: item.id, dayIndex: item.dayIndex, order: item.order }))
        }
      })
      // Re-throw to preserve the error for the error boundary
      throw error
    }
  }

  const handleUpdateItem = async (updatedItem: AgendaItemType) => {
    console.log('🎯 handleUpdateItem function entered')
    
    if (!event.agendaItems) {
      console.error('❌ No agenda items array in event')
      return
    }

    console.log('🔄 handleUpdateItem processing:', {
      id: updatedItem.id,
      topic: updatedItem.topic,
      description: updatedItem.description,
      fullItem: updatedItem
    })
    
    // Check if this is a new item or an existing one
    const isNewItem = updatedItem.id.startsWith('temp-')
    
    try {
      // Prepare the data for Supabase
      const itemData = {
        event_id: updatedItem.event_id,
        topic: updatedItem.topic,
        // Ensure description is not undefined (convert to empty string if needed)
        description: updatedItem.description || '',
        duration_minutes: updatedItem.durationMinutes,
        day_index: updatedItem.dayIndex,
        order_position: updatedItem.order,
        start_time: updatedItem.startTime,
        end_time: updatedItem.endTime,
        is_filler: updatedItem.is_filler || false
      }

      console.log('💾 Preparing database write:', {
        operation: isNewItem ? 'INSERT' : 'UPDATE',
        id: updatedItem.id,
        itemData,
        description: itemData.description
      })

      let savedItem
      if (isNewItem) {
        console.log('➕ Executing INSERT:', {
          data: itemData,
          description: itemData.description
        })

        const { data, error, status, statusText } = await supabase
          .from('agenda_items')
          .insert(itemData)
          .select()
          .single()

        console.log('📥 INSERT response:', {
          success: !error,
          data,
          description: data?.description,
          error
        })

        if (error) {
          console.error('Database insert failed:', {
            error,
            errorMessage: error.message,
            errorDetails: error.details,
            errorHint: error.hint,
            errorCode: error.code,
            itemData,
            status,
            statusText
          })
          throw error
        }
        if (!data) {
          const noDataError = new Error('No data returned from insert operation')
          console.error('Database insert failed:', {
            error: noDataError,
            itemData,
            status,
            statusText
          })
          throw noDataError
        }
        savedItem = data
      } else {
        console.log('✏️ Executing UPDATE using API-first approach for all fields:', {
          id: updatedItem.id,
          itemData
        })

        try {
          // First try using the API endpoint for all updates
          const apiPayload = { 
            itemId: updatedItem.id, 
            description: itemData.description,
            topic: itemData.topic,
            durationMinutes: updatedItem.durationMinutes,
            dayIndex: updatedItem.dayIndex,
            orderPosition: updatedItem.order,
            startTime: itemData.start_time,
            endTime: itemData.end_time,
            isFiller: updatedItem.is_filler,
            fullUpdate: true,
            useDirectSql: true
          };
          
          console.log('📤 API request payload:', JSON.stringify(apiPayload, null, 2));
          
          const response = await fetch('/api/agenda-items/fix-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          })
          
          if (response.ok) {
            const apiResult = await response.json()
            console.log('🔧 API update succeeded:', apiResult)
            
            // Get the updated item data
            const { data: fetchedItem, error: fetchError } = await supabase
              .from('agenda_items')
              .select('*')
              .eq('id', updatedItem.id)
              .single()
              
            if (fetchError) {
              console.warn('Failed to fetch updated item after API update:', fetchError)
              // Continue with regular update as fallback
            } else {
              savedItem = fetchedItem
              // Skip the regular update since the API call was successful
              console.log('Using API-updated item:', savedItem)
            }
          } else {
            // Continue with regular update as fallback
            console.log('API update failed, using fallback methods')
            try {
              // Get details about the error
              const errorResponse = await response.json()
              console.error('API error details:', {
                status: response.status,
                statusText: response.statusText,
                error: errorResponse
              })
              
              // ⚠️ Explicitly throw to ensure errors are visible
              const errorMessage = `API update failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorResponse)}`;
              console.error(errorMessage);
              throw new Error(errorMessage);
            } catch (parseError) {
              console.error('Could not parse error response:', parseError)
              throw new Error(`API update failed: ${response.status} ${response.statusText}`);
            }
          }
        } catch (apiError) {
          console.error('Error with API update, falling back:', apiError)
          // Continue with regular update as fallback
        }

        // Only proceed with fallback updates if we don't have savedItem yet
        if (!savedItem) {
          // Try direct SQL update approach through RPC
          try {
            const { data: sqlData, error: sqlError } = await supabase.rpc('update_agenda_item', {
              item_id: updatedItem.id,
              new_topic: itemData.topic,
              new_description: itemData.description || '',
              new_duration: updatedItem.durationMinutes,
              new_day_index: updatedItem.dayIndex,
              new_order: updatedItem.order,
              new_start_time: itemData.start_time,
              new_end_time: itemData.end_time,
              new_is_filler: updatedItem.is_filler || false
            })

            console.log('🔧 SQL RPC update result:', { sqlData, sqlError })

            if (sqlError) {
              console.error('SQL RPC update failed, falling back to standard update:', sqlError)
              throw sqlError // This will trigger the next fallback
            } else {
              // If SQL update was successful, fetch the updated item
              const { data: fetchedItem, error: fetchError } = await supabase
                .from('agenda_items')
                .select('*')
                .eq('id', updatedItem.id)
                .single()
                
              if (fetchError || !fetchedItem) {
                console.error('Failed to fetch updated item after SQL RPC update:', fetchError)
                throw fetchError || new Error('Failed to fetch updated item')
              }
              
              savedItem = fetchedItem
            }
          } catch (sqlError) {
            // Final fallback: standard Supabase update
            console.log('Using final fallback: standard Supabase update')
            
            const { data, error, status, statusText } = await supabase
              .from('agenda_items')
              .update(itemData)
              .eq('id', updatedItem.id)
              .select()
              .single()

            console.log('📥 Standard UPDATE response (fallback):', {
              success: !error,
              data,
              description: data?.description,
              error
            })

            if (error) {
              console.error('Database update failed:', {
                error,
                errorMessage: error.message,
                errorDetails: error.details,
                errorHint: error.hint,
                errorCode: error.code,
                itemData,
                id: updatedItem.id,
                status,
                statusText
              })
              throw error
            }
            if (!data) {
              const noDataError = new Error('No data returned from update operation')
              console.error('Database update failed:', {
                error: noDataError,
                itemData,
                id: updatedItem.id,
                status,
                statusText
              })
              throw noDataError
            }
            savedItem = data
          }
        }
      }

      console.log('✅ Database save complete:', {
        savedItem,
        description: savedItem.description,
        operation: isNewItem ? 'INSERT' : 'UPDATE'
      })

      // Format the saved item to match our AgendaItem type
      const formattedItem: AgendaItemType = {
        id: savedItem.id as string,
        event_id: savedItem.event_id as string,
        topic: savedItem.topic as string,
        description: savedItem.description as string | undefined,
        durationMinutes: savedItem.duration_minutes as number,
        dayIndex: savedItem.day_index as number,
        order: savedItem.order_position as number,
        startTime: savedItem.start_time as string || "",
        endTime: savedItem.end_time as string || "",
        is_filler: savedItem.is_filler as boolean || false
      }

      console.log('🔄 Formatted item:', {
        id: formattedItem.id,
        topic: formattedItem.topic,
        description: formattedItem.description,
        fullItem: formattedItem
      })

      // After successful database save, update the local state
      let updatedItems
      if (isNewItem) {
        updatedItems = [...event.agendaItems, formattedItem]
        console.log('➕ Added new item to local state:', {
          newItem: formattedItem,
          description: formattedItem.description,
          totalItems: updatedItems.length
        })
      } else {
        updatedItems = event.agendaItems.map((item) => {
          if (item.id === updatedItem.id) {
            console.log('✏️ Updating item in local state:', {
              id: item.id,
              oldDescription: item.description,
              newDescription: formattedItem.description
            })
            return formattedItem
          }
          return item
        })
      }

      // Recalculate times
      try {
        const recalculatedItems = calculateAgendaTimes({
          ...event,
          agendaItems: updatedItems,
        })

        console.log('Saving updated items:', {
          itemCount: recalculatedItems.length,
          updatedItem: recalculatedItems.find(item => item.id === updatedItem.id)
        })

        // Update the event
        onEventUpdate({
          ...event,
          agendaItems: recalculatedItems,
        })
      } catch (error) {
        console.error('Error in calculateAgendaTimes:', {
          error,
          stack: error instanceof Error ? error.stack : 'No stack trace available',
          eventData: {
            itemCount: updatedItems.length,
            items: updatedItems.map(item => ({ 
              id: item.id, 
              dayIndex: item.dayIndex, 
              order: item.order,
              description: item.description 
            }))
          }
        })
        throw error
      }
    } catch (error) {
      console.error('Error in handleUpdateItem:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        updatedItem,
        event_id: event.id
      })
      // Re-throw to preserve the error for the error boundary
      throw error
    }

    setEditingItemId(null)
  }

  const handleDeleteItem = (itemId: string) => {
    if (!itemId || !event.agendaItems) return
    
    // Remove the item and update orders
    const remainingItems = event.agendaItems
      .filter(item => item.id !== itemId)
      .map(item => {
        if (item.dayIndex === activeDayIndex) {
          const dayItems = event.agendaItems
            .filter(i => i.dayIndex === activeDayIndex && i.id !== itemId)
            .sort((a, b) => a.order - b.order)
          const newOrder = dayItems.findIndex(i => i.id === item.id)
          return { ...item, order: newOrder >= 0 ? newOrder : item.order }
        }
        return item
      })

    // Recalculate times
    try {
      const recalculatedItems = calculateAgendaTimes({
        ...event,
        agendaItems: remainingItems,
      })

      // Update the event
      onEventUpdate({
        ...event,
        agendaItems: recalculatedItems,
      })
    } catch (error) {
      console.error('Error in calculateAgendaTimes:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        eventData: {
          itemCount: remainingItems.length,
          items: remainingItems.map(item => ({ id: item.id, dayIndex: item.dayIndex, order: item.order }))
        }
      })
      // Re-throw to preserve the error for the error boundary
      throw error
    }
  }

  const moveItem = (itemId: string, direction: "up" | "down" | "top" | "bottom") => {
    if (!event.agendaItems) return

    // Find the item to move
    const itemIndex = activeItems.findIndex((item) => item.id === itemId)
    if (itemIndex === -1) return

    // Create a copy of the active items
    const items = [...activeItems]
    const item = items[itemIndex]

    // Remove the item from its current position
    items.splice(itemIndex, 1)

    // Determine the new position
    let newIndex
    switch (direction) {
      case "up":
        newIndex = Math.max(0, itemIndex - 1)
        break
      case "down":
        newIndex = Math.min(items.length, itemIndex + 1)
        break
      case "top":
        newIndex = 0
        break
      case "bottom":
        newIndex = items.length
        break
      default:
        newIndex = itemIndex
    }

    // Insert the item at the new position
    items.splice(newIndex, 0, item)

    // Update the order of all items
    const reorderedItems = items.map((item, index) => ({
      ...item,
      order: index,
    }))

    // Combine with items from other days
    const updatedItems = event.agendaItems
      .filter((item) => item.dayIndex !== activeDayIndex)
      .concat(reorderedItems)

    // Recalculate times
    try {
      const recalculatedItems = calculateAgendaTimes({
        ...event,
        agendaItems: updatedItems,
      })

      // Update the event
      onEventUpdate({
        ...event,
        agendaItems: recalculatedItems,
      })
    } catch (error) {
      console.error('Error in calculateAgendaTimes:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace available',
        eventData: {
          itemCount: updatedItems.length,
          items: updatedItems.map(item => ({ id: item.id, dayIndex: item.dayIndex, order: item.order }))
        }
      })
      // Re-throw to preserve the error for the error boundary
      throw error
    }
  }

  if (eventDays.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="mb-4 text-muted-foreground">
              Please set the event date range in the Event Details tab first.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-semibold mr-2">
          {event.title ? (
            <>
              <span className="text-muted-foreground">Event:</span>{" "}
              {event.title.length > 20 ? `${event.title.substring(0, 20)}...` : event.title}
            </>
          ) : (
            "Untitled Event"
          )}
        </h2>
        <span className="mx-2 text-muted-foreground">/</span>
        <div className="flex overflow-x-auto">
          {eventDays.map((day) => (
            <Button
              key={day.dayIndex}
              variant={activeDayIndex === day.dayIndex ? "default" : "ghost"}
              className="whitespace-nowrap"
              onClick={() => setActiveDayIndex(day.dayIndex)}
            >
              {format(day.date, "MMM d")}
            </Button>
          ))}
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="agenda-items">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {activeItems.sort((a, b) => a.order - b.order).map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                    >
                      <AgendaItem
                        item={item}
                        dragHandleProps={provided.dragHandleProps || undefined}
                        onEdit={() => setEditingItemId(item.id)}
                        onDelete={() => handleDeleteItem(item.id)}
                        onMoveUp={() => moveItem(item.id, "up")}
                        onMoveDown={() => moveItem(item.id, "down")}
                        onMoveTop={() => moveItem(item.id, "top")}
                        onMoveBottom={() => moveItem(item.id, "bottom")}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {editingItemId ? (
        <AgendaItemForm
          eventId={event.id}
          item={(() => {
            const item = event.agendaItems?.find((item) => item.id === editingItemId)
            console.log('🔍 Loading item for edit:', {
              editingItemId,
              foundItem: item,
              description: item?.description
            })
            return item
          })()}
          onClose={() => setEditingItemId(null)}
          onSave={(updatedItem) => {
            try {
              console.log('⭐ AgendaTimeline received save event:', {
                id: updatedItem.id,
                topic: updatedItem.topic,
                description: updatedItem.description
              })

              if (!updatedItem) {
                console.error('❌ No item data received in onSave')
                return
              }

              console.log('⭐ About to call handleUpdateItem')
              handleUpdateItem(updatedItem)
              console.log('⭐ handleUpdateItem call completed')
            } catch (error) {
              console.error('❌ Error in AgendaTimeline onSave:', {
                error,
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                updatedItem
              })
              throw error
            }
          }}
        />
      ) : showNewItemForm ? (
        <AgendaItemForm
          eventId={event.id}
          onClose={() => setShowNewItemForm(false)}
          onSave={(newItem) => {
            console.log('New item form onSave called with:', newItem)
            try {
              const itemWithPosition = {
                ...newItem,
                order: activeItems.length,
              }
              handleUpdateItem(itemWithPosition)
              setShowNewItemForm(false)
            } catch (error) {
              console.error('Error in new item creation:', {
                error,
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                newItem
              })
              throw error // Re-throw to trigger error boundary
            }
          }}
        />
      ) : (
        <Button
          className="w-full mt-4"
          variant="outline"
          onClick={() => setShowNewItemForm(true)}
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      )}
    </div>
  )
}