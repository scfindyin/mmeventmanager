"use client";

import { cn } from "@/lib/utils";
import { RangeCalendar } from "@/components/ui/calendar-rac";
import { DateInput, dateInputStyle } from "@/components/ui/datefield-rac";
import { CalendarIcon } from "lucide-react";
import { 
  Button, 
  DateRangePicker as RACDateRangePicker, 
  Dialog, 
  Group, 
  Popover
} from "react-aria-components";
import { FormControl, FormItem, FormLabel, FormMessage } from "./form";
import { useEffect, useState } from "react";
import { DateValue, CalendarDate, parseDate } from "@internationalized/date";

// Define the proper type for the range value
type DateRange = {
  start: DateValue | null;
  end: DateValue | null;
};

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  label?: string;
  className?: string;
}

export function DateRangePicker({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange, 
  label = "Date Range",
  className 
}: DateRangePickerProps) {
  // Convert JavaScript Date objects to DateValue objects for React Aria
  const convertToDateRange = (): DateRange => {
    return {
      start: startDate ? parseDate(startDate.toISOString().split('T')[0]) : null,
      end: endDate ? parseDate(endDate.toISOString().split('T')[0]) : null
    };
  };

  const [value, setValue] = useState<DateRange>(
    startDate && endDate 
      ? convertToDateRange() 
      : { start: null, end: null }
  );

  // Update internal value when props change
  useEffect(() => {
    if (startDate || endDate) {
      setValue(convertToDateRange());
    }
  }, [startDate, endDate]);

  // Handle changes from the date range picker
  const handleChange = (range: DateRange | null) => {
    if (range) {
      setValue(range);
      
      // Convert CalendarDate back to JavaScript Date
      if (range.start) {
        const jsDate = new Date(
          range.start.year,
          range.start.month - 1,
          range.start.day,
          12
        );
        onStartDateChange(jsDate);
      } else {
        onStartDateChange(undefined);
      }
      
      if (range.end) {
        const jsDate = new Date(
          range.end.year,
          range.end.month - 1,
          range.end.day,
          12
        );
        onEndDateChange(jsDate);
      } else {
        onEndDateChange(undefined);
      }
    } else {
      setValue({ start: null, end: null });
      onStartDateChange(undefined);
      onEndDateChange(undefined);
    }
  };

  return (
    <FormItem className={cn("flex flex-col", className)}>
      {label && <FormLabel>{label}</FormLabel>}
      <FormControl>
        <RACDateRangePicker 
          value={value as any} 
          onChange={handleChange}
        >
          <div className="flex relative">
            <Group className={cn(dateInputStyle, "w-full pe-9")}>
              <DateInput slot="start" className="text-sm" unstyled />
              <span aria-hidden="true" className="text-muted-foreground px-2">
                -
              </span>
              <DateInput slot="end" className="text-sm" unstyled />
            </Group>
            <Button className="absolute right-0 text-muted-foreground hover:text-foreground focus:ring-ring/50 z-10 flex w-9 h-9 items-center justify-center rounded-md transition-[color,box-shadow] outline-none focus:ring-2">
              <CalendarIcon size={16} />
            </Button>
          </div>
          <Popover
            className="bg-background text-popover-foreground z-50 rounded-md border shadow-md outline-none data-[entering]:animate-in data-[exiting]:animate-out data-[entering]:fade-in-0 data-[exiting]:fade-out-0"
            offset={4}
            placement="bottom start"
          >
            <Dialog className="p-3">
              <RangeCalendar value={value as any} onChange={handleChange} />
            </Dialog>
          </Popover>
        </RACDateRangePicker>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
} 