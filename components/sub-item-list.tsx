"use client"

import { useState, useEffect } from "react"
import { Plus, Trash, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase, type SubItem } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"

interface SubItemListProps {
  agendaItemId: string
  onStayOnPage?: () => void  // Optional callback to indicate we want to stay on the page
}

export function SubItemList({ agendaItemId, onStayOnPage }: SubItemListProps) {
  const [subItems, setSubItems] = useState<SubItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newContent, setNewContent] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchSubItems()
  }, [agendaItemId])

  async function fetchSubItems() {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("sub_items")
        .select("*")
        .eq("agenda_item_id", agendaItemId)
        .order("position")

      if (error) throw error
      setSubItems(data || [])
    } catch (error: any) {
      toast({
        title: "Error fetching sub-items",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function addSubItem() {
    if (!newContent.trim()) {
      toast({
        title: "Missing content",
        description: "Please provide content for the sub-item.",
        variant: "destructive",
      })
      return
    }

    try {
      // Get the highest position
      let position = 0
      if (subItems.length > 0) {
        position = Math.max(...subItems.map((item) => item.position)) + 1
      }

      const { error } = await supabase.from("sub_items").insert({
        agenda_item_id: agendaItemId,
        content: newContent.trim(),
        position,
      })

      if (error) throw error

      setNewContent("")
      fetchSubItems()
      
      // Call onStayOnPage if provided
      if (onStayOnPage) onStayOnPage()
      
      toast({
        title: "Sub-item added",
        description: "Your sub-item has been added successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error adding sub-item",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  async function removeSubItem(id: string) {
    try {
      const { error } = await supabase.from("sub_items").delete().eq("id", id)

      if (error) throw error
      
      fetchSubItems()
      
      // Call onStayOnPage if provided
      if (onStayOnPage) onStayOnPage()
      
      toast({
        title: "Sub-item removed",
        description: "Your sub-item has been removed successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error removing sub-item",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  async function handleDragEnd(result: any) {
    if (!result.destination) return

    const items = Array.from(subItems)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update the UI immediately
    setSubItems(items)

    // Update positions in the database
    try {
      for (let i = 0; i < items.length; i++) {
        await supabase.from("sub_items").update({ position: i }).eq("id", items[i].id)
      }
      
      // Call onStayOnPage if provided
      if (onStayOnPage) onStayOnPage()
      
      toast({
        title: "Sub-items reordered",
        description: "Your sub-items have been reordered successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error updating positions",
        description: error.message,
        variant: "destructive",
      })
      // Revert to original order on error
      fetchSubItems()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Sub-item content"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addSubItem()
            }
          }}
        />
        <Button onClick={addSubItem}>
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4">Loading sub-items...</div>
      ) : subItems.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">No sub-items added yet</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sub-items">
            {(provided) => (
              <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {subItems.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided) => (
                      <li
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex items-center gap-2 border rounded-md p-2 bg-background"
                      >
                        <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <span className="flex-1">{item.content}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeSubItem(item.id)}>
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  )
}

