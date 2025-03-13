"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label = "Date Range",
  className,
  disabled
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  // Create a dateRange object for the calendar
  const dateRange: DateRange | undefined = startDate && endDate 
    ? { from: startDate, to: endDate } 
    : startDate 
      ? { from: startDate, to: undefined } 
      : undefined;
      
  // Format dates for display
  const formattedStartDate = startDate ? format(startDate, "PPP") : "";
  const formattedEndDate = endDate ? format(endDate, "PPP") : "";
  const displayText = startDate && endDate 
    ? `${formattedStartDate} - ${formattedEndDate}`
    : startDate 
      ? `${formattedStartDate} - Select end date` 
      : "Select date range";
  
  // Handle date range selection
  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      // Set time to noon to avoid timezone issues
      const start = new Date(range.from);
      start.setHours(12, 0, 0, 0);
      onStartDateChange(start);
      
      if (range.to) {
        const end = new Date(range.to);
        end.setHours(12, 0, 0, 0);
        onEndDateChange(end);
        setIsCalendarOpen(false); // Close after full range selection
      } else {
        onEndDateChange(undefined);
      }
    } else {
      onStartDateChange(undefined);
      onEndDateChange(undefined);
    }
  };
  
  return (
    <FormItem className={cn("flex flex-col", className)}>
      {label && <FormLabel>{label}</FormLabel>}
      <FormControl>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !startDate && !endDate && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {displayText}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleRangeSelect}
              initialFocus
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
} 