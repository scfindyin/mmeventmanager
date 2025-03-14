// components/ui/TimePicker.tsx
import React, { useState, CSSProperties } from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from 'next-themes';

interface TimePickerProps {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  increment?: number;
  minTime?: string;
}

// Convert 24h time string to 12h display format
const formatTo12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Single TimePicker component
const TimePicker: React.FC<TimePickerProps> = ({
  label = "Select time",
  value,
  onChange,
  increment = 30,
  minTime
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Generate time options
  const generateTimeOptions = () => {
    const options = [];
    
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += increment) {
        const formattedHour = String(hour).padStart(2, '0');
        const formattedMinute = String(minute).padStart(2, '0');
        const timeValue = `${formattedHour}:${formattedMinute}`;
        
        // Always use 12h format for display
        const displayTime = formatTo12Hour(timeValue);
        
        // Check if this time should be disabled (earlier than minTime)
        const isDisabled = minTime ? timeValue < minTime : false;
        
        options.push({
          value: timeValue,
          label: displayTime,
          disabled: isDisabled
        });
      }
    }
    
    return options;
  };
  
  const timeOptions = generateTimeOptions();
  
  // Toggle the dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  const selectTime = (timeValue: string) => {
    onChange(timeValue);
    setIsOpen(false);
  };
  
  return (
    <div className="w-full relative">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </label>
      )}
      
      <button
        type="button"
        className={`flex justify-between items-center w-full border rounded-md px-3 py-2 text-left ${
          isHovered ? (isDark ? 'bg-gray-800' : 'bg-gray-50') : (isDark ? 'bg-gray-950' : 'bg-white')
        } ${isDark ? 'border-gray-700 text-gray-100' : 'border-gray-200'}`}
        onClick={toggleDropdown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>{formatTo12Hour(value)}</span>
        <Clock className={`h-4 w-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      </button>
      
      {isOpen && (
        <div className={`absolute z-10 mt-1 w-full ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-md shadow-lg max-h-60 overflow-auto`}>
          <div className="py-1">
            {timeOptions.map((option) => (
              <div
                key={option.value}
                className={`px-4 py-2 ${
                  option.disabled 
                    ? (isDark ? 'text-gray-600' : 'text-gray-300') + ' cursor-not-allowed' 
                    : (isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100') + ' cursor-pointer'
                } ${
                  option.value === value 
                    ? (isDark ? 'bg-gray-800' : 'bg-gray-100') + ' font-medium' 
                    : ''
                } ${isDark ? 'text-gray-100' : ''}`}
                onClick={() => !option.disabled && selectTime(option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// TimeRangePicker component props interface
export interface TimeRangePickerProps {
  onChange?: (range: { start: string; end: string }) => void;
  initialStartTime?: string;
  initialEndTime?: string;
  increment?: number;
}

// TimeRangePicker component
export function TimeRangePicker({
  onChange,
  initialStartTime = '09:00',
  initialEndTime = '17:00',
  increment = 30
}: TimeRangePickerProps) {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  
  // Handle start time change
  const handleStartTimeChange = (time: string) => {
    setStartTime(time);
    
    // If endTime is earlier than new startTime, adjust it
    if (endTime < time) {
      // Calculate a reasonable default end time (e.g., start + 1 hour)
      const [startHour, startMinute] = time.split(':').map(Number);
      let endHour = startHour + 1;
      const endMinute = startMinute;
      
      // Handle day wrap
      if (endHour >= 24) {
        endHour = 23;
      }
      
      const newEndTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      setEndTime(newEndTime);
      
      // Notify parent of both changes
      if (onChange) {
        onChange({ start: time, end: newEndTime });
      }
    } else {
      // Just notify of start time change
      if (onChange) {
        onChange({ start: time, end: endTime });
      }
    }
  };
  
  // Handle end time change
  const handleEndTimeChange = (time: string) => {
    setEndTime(time);
    
    if (onChange) {
      onChange({ start: startTime, end: time });
    }
  };
  
  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <TimePicker 
          label="Start Time" 
          value={startTime} 
          onChange={handleStartTimeChange} 
          increment={increment}
        />
      </div>
      <div className="flex-1">
        <TimePicker 
          label="End Time" 
          value={endTime} 
          onChange={handleEndTimeChange} 
          increment={increment}
          minTime={startTime} // Disable times before start time
        />
      </div>
    </div>
  );
}

export default TimePicker;