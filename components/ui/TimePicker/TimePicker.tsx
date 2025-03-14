// components/ui/TimePicker.tsx
import React, { useState, CSSProperties } from 'react';
import { Clock } from 'lucide-react';

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
  const [isHovered, setIsHovered] = useState(false);
  
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
  
  // Styles with TypeScript type assertions
  const styles: {
    container: CSSProperties;
    label: CSSProperties;
    selectContainer: CSSProperties;
    select: CSSProperties;
    icon: CSSProperties;
  } = {
    container: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      marginBottom: '8px'
    },
    selectContainer: {
      position: 'relative',
      width: '100%'
    },
    select: {
      width: '100%',
      height: '40px',
      padding: '8px 12px 8px 36px',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      appearance: 'none',
      fontSize: '14px',
      backgroundColor: isHovered ? '#f3f4f6' : 'white',
      cursor: 'pointer',
      transition: 'background-color 150ms ease'
    },
    icon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6b7280',
      pointerEvents: 'none'
    }
  };
  
  return (
    <div style={styles.container}>
      <label style={styles.label}>{label}</label>
      <div style={styles.selectContainer}>
        <Clock size={16} style={styles.icon} />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.select}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {timeOptions.map((option) => (
            <option 
              key={option.value} 
              value={option.value} 
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
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
    
    // If new start time is after current end time, update end time
    if (time >= endTime) {
      // Add at least one increment to the start time
      const [hours, minutes] = time.split(':').map(Number);
      let newEndHours = hours;
      let newEndMinutes = minutes + increment;
      
      if (newEndMinutes >= 60) {
        newEndHours = (newEndHours + 1) % 24;
        newEndMinutes = newEndMinutes % 60;
      }
      
      const newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMinutes).padStart(2, '0')}`;
      setEndTime(newEndTime);
      
      if (onChange) {
        onChange({ start: time, end: newEndTime });
      }
    } else if (onChange) {
      onChange({ start: time, end: endTime });
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
    <div>
      <TimePicker
        label="Start Time"
        value={startTime}
        onChange={handleStartTimeChange}
        increment={increment}
      />
      
      <TimePicker
        label="End Time"
        value={endTime}
        onChange={handleEndTimeChange}
        increment={increment}
        minTime={startTime}
      />
    </div>
  );
}