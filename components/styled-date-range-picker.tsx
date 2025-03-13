// components/styled-date-range-picker.tsx
"use client"

import React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { UseFormReturn } from "react-hook-form";

interface DateRangePickerProps {
  form: UseFormReturn<any>;
  startDateName: string;
  endDateName: string;
  className?: string;
  onDateChange?: (range: { from?: Date; to?: Date }) => void;
}

export function StyledDateRangePicker({ 
  form, 
  startDateName, 
  endDateName, 
  className,
  onDateChange
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal px-3 py-2 h-10 border-input", 
              !form.watch(startDateName) && "text-muted-foreground"
            )}
          >
            <div className="flex items-center w-full">
              <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center">
                <div className="text-center">
                  {form.watch(startDateName) ? format(form.watch(startDateName), "M/dd/yyyy") : "Start date"}
                </div>
                <div className="mx-2">-</div>
                <div className="text-center">
                  {form.watch(endDateName) ? format(form.watch(endDateName), "M/dd/yyyy") : "End date"}
                </div>
              </div>
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={form.watch(startDateName) || new Date()}
            selected={{
              from: form.watch(startDateName) || undefined,
              to: form.watch(endDateName) || undefined,
            }}
            onSelect={(range) => {
              if (range?.from) {
                form.setValue(startDateName, range.from, { shouldValidate: true });
              }
              if (range?.to) {
                form.setValue(endDateName, range.to, { shouldValidate: true });
              }
              
              if (onDateChange) {
                onDateChange(range || {});
              }
            }}
            numberOfMonths={1}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}