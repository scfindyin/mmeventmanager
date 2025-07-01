"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

// Convert 24-hour format to 12-hour format for display
function formatTo12Hour(time24h: string): string {
  const [hours, minutes] = time24h.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Compare two time strings (24h format)
function isTimeBefore(time1: string, time2: string): boolean {
  const [hours1, minutes1] = time1.split(':').map(Number);
  const [hours2, minutes2] = time2.split(':').map(Number);
  
  if (hours1 < hours2) return true;
  if (hours1 > hours2) return false;
  return minutes1 < minutes2;
}

interface BasicTimePickerProps {
  value?: string;
  onChange?: (timeValue: string) => void;
  label?: string;
  minTime?: string; // New prop to disable times before this value
  timeIncrementMinutes?: number; // Time increment in minutes (1, 5, 10, 15, 30, 60)
  disabled?: boolean; // Disable the entire picker
}

export default function BasicTimePicker({ 
  value = "09:00", 
  onChange,
  label = "Select time",
  minTime,
  timeIncrementMinutes = 15,
  disabled = false
}: BasicTimePickerProps) {
  const [time, setTime] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Update the internal state when the prop value changes
  useEffect(() => {
    setTime(value);
  }, [value]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Scroll to the selected time when dropdown opens
  useEffect(() => {
    if (isOpen && selectedItemRef.current && dropdownListRef.current) {
      // Wait a tiny bit for the dropdown to render fully
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({
          block: 'center',
          behavior: 'auto'
        });
      }, 50);
    }
  }, [isOpen]);
  
  const handleTimeSelect = (timeValue: string) => {
    setTime(timeValue);
    setIsOpen(false);
    
    // Call the parent's onChange handler if provided
    if (onChange) {
      onChange(timeValue);
    }
  };
  
  // Generate time options based on the timeIncrementMinutes
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += timeIncrementMinutes) {
      const formattedHour = String(hour).padStart(2, '0');
      const formattedMinute = String(minute).padStart(2, '0');
      const timeValue = `${formattedHour}:${formattedMinute}`;
      
      timeOptions.push({
        value: timeValue,
        label: formatTo12Hour(timeValue),
        // Disable if this time is before minTime
        disabled: minTime ? !isTimeBefore(minTime, timeValue) : false
      });
    }
  }
  
  return (
    <div className="w-full">
      <div className="relative" ref={dropdownRef}>
        {/* Button that looks like your date picker */}
        <button
          type="button"
          className={`flex justify-between items-center w-full border rounded-md px-3 py-2 text-left ${isHovered ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-950'} dark:border-gray-700 dark:text-gray-100 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onMouseEnter={() => !disabled && setIsHovered(true)}
          onMouseLeave={() => !disabled && setIsHovered(false)}
          disabled={disabled}
        >
          <span>{formatTo12Hour(time)}</span>
          <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
        
        {/* Dropdown that appears below */}
        {isOpen && (
          <div 
            className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto" 
            ref={dropdownListRef}
          >
            <div className="py-1">
              {timeOptions.map(option => {
                const isSelected = time === option.value;
                return (
                  <div
                    key={option.value}
                    ref={isSelected ? selectedItemRef : null}
                    className={`px-4 py-2 ${
                      option.disabled 
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                    } ${isSelected ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''} dark:text-gray-100`}
                    onClick={() => !option.disabled && handleTimeSelect(option.value)}
                  >
                    {option.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}