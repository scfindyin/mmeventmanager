"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

import "react-day-picker/dist/style.css"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // Custom nav icons to ensure proper styling
  const IconLeft = React.forwardRef<HTMLButtonElement>((props, ref) => (
    <button 
      ref={ref} 
      {...props} 
      className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  ))
  IconLeft.displayName = "IconLeft"
  
  const IconRight = React.forwardRef<HTMLButtonElement>((props, ref) => (
    <button 
      ref={ref} 
      {...props} 
      className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  ))
  IconRight.displayName = "IconRight"

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "relative flex items-center justify-center px-1 py-3",
        caption_label: "text-base font-medium mx-auto",
        nav: "absolute top-3 left-1 right-1 flex justify-between items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full mb-2",
        head_cell:
          "text-muted-foreground text-center uppercase w-9 h-9 font-medium text-[0.75rem] flex items-center justify-center",
        row: "flex w-full mt-2",
        cell: "relative p-0 text-center flex items-center justify-center h-9 w-9",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal rounded-md aria-selected:opacity-100 hover:bg-accent"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft,
        IconRight
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
