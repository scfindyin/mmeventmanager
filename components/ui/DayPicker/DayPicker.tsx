"use client";

// components/ui/DayPicker/DayPicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';

// Helper function to format date inside the component instead of importing
const formatDate = (date: Date): string => {
  if (!date) return '';
  
  const months: string[] = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const day: number = date.getDate();
  const month: string = months[date.getMonth()];
  const year: number = date.getFullYear();
  
  return `${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
};

// Helper function for ordinal suffix
const getOrdinalSuffix = (n: number): string => {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

interface DayPickerProps {
  onChange?: (date: Date) => void;
  label?: string;
  initialDate?: Date;
  minDate?: Date;
}

interface HoverStates {
  mainButton: boolean;
  prevButton: boolean;
  nextButton: boolean;
  days: Record<string, boolean>;
}

export const DayPicker: React.FC<DayPickerProps> = ({ 
  onChange, 
  label = "Date picker",
  initialDate = new Date(),
  minDate
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [date, setDate] = useState<Date>(initialDate);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [hoverStates, setHoverStates] = useState<HoverStates>({
    mainButton: false,
    prevButton: false,
    nextButton: false,
    days: {}
  });
  
  // Add refs for click-outside handling
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calendar view state
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  
  const months: string[] = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const weekdays: string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Improved click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Only close if clicking outside our component hierarchy
      if (isOpen && 
          containerRef.current && 
          !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    // Only add the event listener when the popover is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen]);
  
  // Prevent any event handler errors from crashing the component
  const safeEventHandler = (handler: (e: React.MouseEvent) => void) => {
    return (e: React.MouseEvent) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    };
  };
  
  const toggleCalendar = safeEventHandler((event: React.MouseEvent) => {
    setIsOpen(!isOpen);
  });

  const handleDateSelect = safeEventHandler((event: React.MouseEvent) => {
    // Cast target to get the day value from the data attribute
    const target = event.currentTarget as HTMLDivElement;
    const day = Number(target.dataset.day);
    
    if (isNaN(day)) return;
    
    const newDate = new Date(viewYear, viewMonth, day);
    
    // Check if the date is below minDate
    if (minDate && newDate < minDate) {
      // Don't select dates before minDate
      return;
    }
    
    setDate(newDate);
    setIsOpen(false);
    
    // Trigger onChange callback if provided
    if (onChange) {
      onChange(newDate);
    }
  });
  
  const goToPreviousMonth = safeEventHandler((event: React.MouseEvent) => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  });
  
  const goToNextMonth = safeEventHandler((event: React.MouseEvent) => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  });
  
  // Set hover state for a specific element
  const setHoverState = (element: keyof HoverStates, key: string | null, value: boolean): void => {
    if (key !== null && element === 'days') {
      setHoverStates(prev => ({
        ...prev,
        [element]: { ...prev[element], [key]: value }
      }));
    } else if (element !== 'days') {
      setHoverStates(prev => ({
        ...prev,
        [element]: value
      }));
    }
  };
  
  // Generate calendar days
  const generateCalendarDays = (): (number | null)[] => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    
    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };
  
  const isSelectedDay = (day: number | null): boolean => {
    if (day === null) return false;
    return date.getDate() === day && 
           date.getMonth() === viewMonth && 
           date.getFullYear() === viewYear;
  };
  
  const calendarDays = generateCalendarDays();
  
  // Split the days into weeks
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  
  calendarDays.forEach((day, index) => {
    week.push(day);
    if (index % 7 === 6 || index === calendarDays.length - 1) {
      weeks.push(week);
      week = [];
    }
  });
  
  // Fill out the last week if needed
  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }
  
  // Function to determine if a day is disabled (before minDate)
  const isDisabled = (day: number | null): boolean => {
    if (day === null) return true;
    if (!minDate) return false;
    
    const testDate = new Date(viewYear, viewMonth, day);
    return testDate < minDate;
  };
  
  // Styles with hover states
  const styles = {
    container: {
      width: '100%',
      boxSizing: 'border-box' as const,
      position: 'relative' as const
    },
    labelText: {
      marginBottom: '4px',
      fontSize: '14px',
      fontWeight: '500',
      color: isDark ? '#e2e8f0' : '#64748b'
    },
    popoverContainer: {
      position: 'relative' as const
    },
    mainButton: {
      width: '100%',
      height: '40px',
      padding: '8px 12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      textAlign: 'left' as const,
      border: `1px solid ${isDark ? '#374151' : '#e2e8f0'}`,
      borderRadius: '6px',
      backgroundColor: hoverStates.mainButton 
        ? (isDark ? '#374151' : '#f3f4f6') 
        : (isDark ? '#030712' : 'white'),
      color: isDark ? '#e2e8f0' : 'inherit',
      transition: 'background-color 150ms ease',
      cursor: 'pointer'
    },
    calendarIcon: {
      marginLeft: '8px', 
      opacity: 0.7,
      color: isDark ? '#e2e8f0' : 'inherit'
    },
    popover: {
      position: 'absolute' as const, 
      zIndex: 9999, // Very high z-index to prevent issues
      marginTop: '8px', 
      width: '100%',
      backgroundColor: isDark ? '#0f172a' : 'white', 
      border: `1px solid ${isDark ? '#374151' : '#e2e8f0'}`, 
      borderRadius: '8px', 
      boxShadow: isDark 
        ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' 
        : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    },
    calendarContainer: {
      padding: '12px'
    },
    monthNav: {
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '16px'
    },
    navButton: (isHovering: boolean) => ({
      padding: '4px',
      borderRadius: '9999px',
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isHovering 
        ? (isDark ? '#374151' : '#e5e7eb') 
        : 'transparent',
      color: isDark ? '#e2e8f0' : 'inherit',
      cursor: 'pointer',
      transition: 'background-color 150ms ease'
    }),
    monthYearText: {
      fontWeight: '500',
      color: isDark ? '#e2e8f0' : 'inherit'
    },
    weekdaysGrid: {
      display: 'grid', 
      gridTemplateColumns: 'repeat(7, 1fr)', 
      gap: '4px', 
      marginBottom: '8px'
    },
    weekdayHeader: {
      textAlign: 'center' as const, 
      fontSize: '12px', 
      color: isDark ? '#9ca3af' : '#6b7280'
    },
    daysGrid: {
      display: 'grid', 
      gridTemplateColumns: 'repeat(7, 1fr)', 
      gap: '4px'
    },
    calendarDay: (day: number | null, isSelected: boolean, isHovering: boolean): React.CSSProperties => {
      const disabled = isDisabled(day);
      
      return {
        height: '32px',
        width: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: isSelected 
          ? (isDark ? '#2563eb' : 'black') 
          : isHovering 
            ? (isDark ? '#374151' : '#e5e7eb') 
            : 'transparent',
        color: isSelected 
          ? 'white' 
          : day === null 
            ? (isDark ? '#4b5563' : '#d1d5db') 
            : disabled 
              ? (isDark ? '#4b5563' : '#d1d5db') 
              : (isDark ? '#e2e8f0' : 'inherit'),
        cursor: day === null || disabled ? 'default' : 'pointer',
        transition: 'background-color 150ms ease',
        opacity: disabled ? 0.5 : 1,
      }
    }
  };
  
  return (
    <div style={styles.container} ref={containerRef}>
      <div style={styles.labelText}>{label}</div>
      <div style={styles.popoverContainer}>
        {/* Button */}
        <button
          ref={buttonRef}
          style={styles.mainButton}
          onClick={toggleCalendar}
          onMouseEnter={() => setHoverState('mainButton', null, true)}
          onMouseLeave={() => setHoverState('mainButton', null, false)}
        >
          <span>{date ? formatDate(date) : "Pick a date"}</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={styles.calendarIcon}
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
            <line x1="16" x2="16" y1="2" y2="6"></line>
            <line x1="8" x2="8" y1="2" y2="6"></line>
            <line x1="3" x2="21" y1="10" y2="10"></line>
          </svg>
        </button>
        
        {/* Calendar Popover */}
        {isOpen && (
          <div 
            ref={popoverRef}
            style={styles.popover}
          >
            <div style={styles.calendarContainer}>
              {/* Month Navigation */}
              <div style={styles.monthNav}>
                <button 
                  style={styles.navButton(hoverStates.prevButton)}
                  onClick={goToPreviousMonth}
                  onMouseEnter={() => setHoverState('prevButton', null, true)}
                  onMouseLeave={() => setHoverState('prevButton', null, false)}
                >
                  &lt;
                </button>
                <div style={styles.monthYearText}>
                  {`${months[viewMonth]} ${viewYear}`}
                </div>
                <button 
                  style={styles.navButton(hoverStates.nextButton)}
                  onClick={goToNextMonth}
                  onMouseEnter={() => setHoverState('nextButton', null, true)}
                  onMouseLeave={() => setHoverState('nextButton', null, false)}
                >
                  &gt;
                </button>
              </div>
              
              {/* Weekday Headers */}
              <div style={styles.weekdaysGrid}>
                {weekdays.map(day => (
                  <div key={day} style={styles.weekdayHeader}>
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Grid */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} style={styles.daysGrid}>
                  {week.map((day, dayIndex) => {
                    const dayKey = `${weekIndex}-${dayIndex}`;
                    const isSelected = isSelectedDay(day);
                    const isHovering = hoverStates.days[dayKey];
                    const disabled = isDisabled(day);
                    
                    return (
                      <div 
                        key={dayKey}
                        data-day={day} // Add data attribute for safer event handling
                        style={styles.calendarDay(day, isSelected, isHovering)}
                        onClick={!disabled && day !== null ? handleDateSelect : undefined}
                        onMouseEnter={() => !disabled && day !== null && setHoverState('days', dayKey, true)}
                        onMouseLeave={() => !disabled && day !== null && setHoverState('days', dayKey, false)}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};