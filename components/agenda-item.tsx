"use client"

import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RichTextDisplay } from "@/components/rich-text-display"
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Edit, Trash2, GripVertical } from "lucide-react"
import { type AgendaItem as AgendaItemType } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import { FixDescriptionButton } from "@/components/fix-description-button"
import { TestSaveButton } from "@/components/test-save-button"

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
  // Function to format duration in hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} min`;
    } else if (remainingMinutes === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${remainingMinutes} min`;
    }
  };

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
              <div className="text-sm text-muted-foreground">({formatDuration(item.durationMinutes)})</div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {item.startTime} - {item.endTime}
              </span>
            </div>

            {item.description && (
              <div className="mt-2 text-sm text-muted-foreground">
                <RichTextDisplay 
                  content={item.description}
                  className="text-sm text-muted-foreground"
                />
              </div>
            )}
            
            {/* Replace the existing debug section with our full diagnostics */}
            <div className="mt-2 text-xs text-muted-foreground border-t border-dashed pt-2">
              <details className="cursor-pointer">
                <summary className="font-semibold text-muted-foreground">Diagnostics</summary>
                <div className="flex flex-col mt-2 gap-3">
                  <div>
                    <h4 className="text-xs mb-1 font-medium">Force Update</h4>
                    <FixDescriptionButton 
                      itemId={item.id} 
                      description={item.description || ''} 
                    />
                  </div>
                  <div>
                    <h4 className="text-xs mb-1 font-medium">Test Direct Save</h4>
                    <TestSaveButton itemId={item.id} />
                  </div>
                  <div className="mt-2">
                    <h4 className="text-xs mb-1 font-medium">Item Data</h4>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
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

