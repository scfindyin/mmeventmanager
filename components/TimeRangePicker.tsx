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

// Generate time options in 30-minute increments
function generateTimeOptions() {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const formattedHour = String(hour).padStart(2, '0');
      const formattedMinute = String(minute).padStart(2, '0');
      const timeValue = `${formattedHour}:${formattedMinute}`;
      
      options.push({
        value: timeValue,
        label: formatTo12Hour(timeValue)
      });
    }
  }
  return options;
}

interface TimePickerProps {
  label: string;
  selectedTime: string;
  onTimeChange: (time: string) => void;
  disabledBefore?: string;
}

// Individual TimePicker component
function TimePicker({ label, selectedTime, onTimeChange, disabledBefore }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Generate all time options
  const allTimeOptions = generateTimeOptions();
  
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
  
  // Scroll to selected time when dropdown opens
  useEffect(() => {
    if (isOpen && selectedItemRef.current) {
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: 'center' });
      }, 0);
    }
  }, [isOpen]);
  
  const handleTimeSelect = (timeValue: string) => {
    onTimeChange(timeValue);
    setIsOpen(false);
  };
  
  return (
    <div className="w-full mb-4">
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="relative" ref={dropdownRef}>
        {/* Button that looks like date picker */}
        <button
          type="button"
          className={`flex justify-between items-center w-full border rounded-md px-3 py-2 text-left ${isHovered ? 'bg-gray-50' : 'bg-white'}`}
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span>{formatTo12Hour(selectedTime)}</span>
          <Clock className="h-4 w-4 text-gray-500" />
        </button>
        
        {/* Dropdown that appears below */}
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="py-1">
              {allTimeOptions.map(option => {
                // Check if this time should be disabled
                const isDisabled = disabledBefore && option.value < disabledBefore;
                
                return (
                  <div
                    key={option.value}
                    ref={selectedTime === option.value ? selectedItemRef : null}
                    className={`px-4 py-2 cursor-pointer ${
                      selectedTime === option.value ? 'bg-gray-100 font-medium' : ''
                    } ${
                      isDisabled 
                        ? 'opacity-50 cursor-not-allowed text-gray-400' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => !isDisabled && handleTimeSelect(option.value)}
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

// TimeRangePicker component with start and end times
export default function TimeRangePicker() {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  
  // When start time changes, ensure end time is valid
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    
    // If end time is now before start time, update it
    if (endTime < newStartTime) {
      // Set end time to start time + 30 min
      const [hours, minutes] = newStartTime.split(':').map(Number);
      let newEndHours = hours;
      let newEndMinutes = minutes + 30;
      
      if (newEndMinutes >= 60) {
        newEndHours = (newEndHours + 1) % 24;
        newEndMinutes = 0;
      }
      
      const newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMinutes).padStart(2, '0')}`;
      setEndTime(newEndTime);
    }
  };
  
  return (
    <div className="w-full max-w-sm">
      <TimePicker 
        label="Start Time"
        selectedTime={startTime}
        onTimeChange={handleStartTimeChange}
      />
      
      <TimePicker 
        label="End Time"
        selectedTime={endTime}
        onTimeChange={setEndTime}
        disabledBefore={startTime}
      />
    </div>
  );
}