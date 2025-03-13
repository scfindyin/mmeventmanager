"use client"

import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Edit, Trash2, GripVertical } from "lucide-react"
import { type AgendaItem as AgendaItemType } from "@/lib/types"
import { Separator } from "@/components/ui/separator"

interface AgendaItemProps {
  item: AgendaItemType
  dragHandleProps?: DraggableProvidedDragHandleProps
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMoveTop: () => void
  onMoveBottom: () => void
}

export function AgendaItem({ 
  item, 
  dragHandleProps, 
  onEdit, 
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onMoveBottom
}: AgendaItemProps) {
  return (
    <Card className="relative">
      <div
        className="absolute left-0 top-0 bottom-0 flex w-10 cursor-move items-center justify-center border-r"
        {...dragHandleProps}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <CardContent className="ml-10 p-4">
        <div className="grid grid-cols-[1fr_auto] gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium">{item.topic}</h3>
              <div className="text-sm text-muted-foreground">({item.durationMinutes} min)</div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {item.startTime} - {item.endTime}
              </span>
            </div>

            {item.description && (
              <div className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveTop}
                className="h-6 w-6"
              >
                <ChevronsUp className="h-4 w-4" />
                <span className="sr-only">Move to top</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveUp}
                className="h-6 w-6"
              >
                <ChevronUp className="h-4 w-4" />
                <span className="sr-only">Move up</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveDown}
                className="h-6 w-6"
              >
                <ChevronDown className="h-4 w-4" />
                <span className="sr-only">Move down</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveBottom}
                className="h-6 w-6"
              >
                <ChevronsDown className="h-4 w-4" />
                <span className="sr-only">Move to bottom</span>
              </Button>
            </div>
            <Separator orientation="vertical" className="h-24" />
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-6 w-6"
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-6 w-6 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

