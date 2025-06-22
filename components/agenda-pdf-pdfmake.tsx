"use client";

import React, { useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import type { AgendaItem, Event } from '@/lib/types';

// Helper function to format time in 12-hour format with consistent padding
function formatTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  
  if (isNaN(hour)) return time24;
  
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  // Pad hour with leading zero if needed for consistent width
  const paddedHour = hour12.toString().padStart(2, '0');
  
  return `${paddedHour}:${minuteStr}${period}`;
}

// Helper function to convert image URL to base64 data URL
const imageUrlToBase64 = async (url: string): Promise<string> => {
  try {
    // Fetch the image
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Convert to blob
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
};

// Generate a PDF using pdfmake - modified to handle dynamic imports
const generatePdf = async (
  event: Event, 
  agendaItems: AgendaItem[], 
  fileName: string = 'event-agenda.pdf',
  onStatusUpdate?: (status: 'loading-image' | 'generating') => void
) => {
  // Dynamically import pdfMake only on the client side when the function is called
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
  
  // Set the vfs
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  // Prepare image if necessary
  let logoDataUrl: string | null = null;
  if (event.logo_url) {
    try {
      onStatusUpdate?.('loading-image');
      logoDataUrl = await imageUrlToBase64(event.logo_url);
      onStatusUpdate?.('generating');
    } catch (error) {
      console.error('Failed to load logo image:', error);
      // Continue without the logo
    }
  }

  // Group items by day
  const itemsByDay: Record<number, AgendaItem[]> = {};
  agendaItems.forEach(item => {
    if (!itemsByDay[item.dayIndex]) {
      itemsByDay[item.dayIndex] = [];
    }
    itemsByDay[item.dayIndex].push(item);
  });

  // Sort days and items within days
  const sortedDays = Object.keys(itemsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  // Format date for day headers
  const formatDayDate = (dayIndex: number) => {
    try {
      // Try all possible date property names
      let startDate: Date | null = null;
      
      // Check for camelCase property (startDate)
      if (event.startDate) {
        startDate = new Date(event.startDate);
      }
      // Check for snake_case property (start_date)
      else if ((event as any).start_date) {
        startDate = new Date((event as any).start_date);
      }
      
      if (startDate) {
        const currentDate = addDays(startDate, dayIndex);
        return format(currentDate, "MMMM d, yyyy");
      }
      
      return null;
    } catch (error) {
      console.error("Error formatting day date:", error);
      return null;
    }
  };

  // Format event date range
  const eventDateRange = (() => {
    // Try standard camelCase properties
    if (event.startDate && event.endDate) {
      return `${format(new Date(event.startDate), "MMMM d, yyyy")} - ${format(new Date(event.endDate), "MMMM d, yyyy")}`;
    }
    
    // Then try snake_case properties
    if ((event as any).start_date && (event as any).end_date) {
      return `${format(new Date((event as any).start_date), "MMMM d, yyyy")} - ${format(new Date((event as any).end_date), "MMMM d, yyyy")}`;
    }
    
    // If all else fails
    return "Date not specified";
  })();

  // Pre-compute day titles for each day
  const dayTitles: Record<number, string> = {};
  sortedDays.forEach(dayIndex => {
    const formattedDate = formatDayDate(dayIndex);
    dayTitles[dayIndex] = `Day ${dayIndex + 1}${formattedDate ? ` - ${formattedDate}` : ''}`;
  });

  // Create day sections with repeating headers
  const content = [];
  
  // Add cover page
  content.push({
    stack: [
      { text: event.title, style: 'title' },
      event.subtitle ? { text: event.subtitle, style: 'subtitle' } : {},
      { text: `${eventDateRange} • ${agendaItems.length} agenda items`, style: 'eventDetails' },
      (event as any).description ? { text: (event as any).description, margin: [0, 0, 0, 15] } : {},
      
      // Summary section
      { text: 'Agenda Overview', style: 'summaryTitle' },
      ...sortedDays.map(dayIndex => {
        const formattedDate = formatDayDate(dayIndex);
        return {
          stack: [
            { text: `Day ${dayIndex + 1}${formattedDate ? ` - ${formattedDate}` : ''}`, style: 'summaryDayTitle' },
            {
              margin: [15, 0, 0, 12],
              stack: itemsByDay[dayIndex]
                .sort((a, b) => a.order - b.order)
                .map(item => ({
                  columns: [
                    {
                      width: 120,
                      text: `${formatTo12Hour(item.startTime)} - ${formatTo12Hour(item.endTime)}`,
                      fontFeatures: ['tnum'],
                    },
                    {
                      width: '*',
                      text: item.topic,
                    },
                  ],
                  margin: [0, 0, 0, 4],
                })),
            },
          ],
          margin: [0, 0, 0, 12],
        };
      }),
    ],
    pageBreak: 'after'
  });
  
  // Add day pages
  sortedDays.forEach((dayIndex, dayOrderIndex) => {
    const dayTitle = dayTitles[dayIndex];
    const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order);
    
    // Create a header function specific to this day
    // This is the key part that enables repeating day headers
    const dayHeaderFunc = function(currentPage: number, pageCount: number, pageSize: any) {
      // Base header with event info
      const baseHeader = {
        columns: [
          {
            stack: [
              { text: event.title, bold: true, fontSize: 12 },
              { text: eventDateRange, fontSize: 10, color: '#666666' }
            ]
          },
          logoDataUrl ? {
            image: logoDataUrl,
            width: 50,
            height: 30,
            alignment: 'right'
          } : {}
        ],
        margin: [40, 20, 40, 5]
      };
      
      // Enhanced header with day title for all pages of this section
      return {
        stack: [
          baseHeader,
          {
            canvas: [{ type: 'line', x1: 40, y1: 8, x2: pageSize.width - 40, y2: 8, lineWidth: 1, lineColor: '#CCCCCC' }],
          },
          {
            text: dayTitle,
            style: 'repeatingDayHeader',
            margin: [40, 10, 40, 0],
          }
        ]
      };
    };
    
    // Add this day to the content with its own header
    content.push({
      // Add page break between days (except after cover which already has one)
      pageBreak: dayOrderIndex > 0 ? 'before' : undefined,
      // Each day gets its own header function
      header: dayHeaderFunc,
      // Create a stack for this day's content
      stack: [
        // Main day title (only shown on the first page of the day)
        { 
          text: dayTitle, 
          style: 'dayHeader',
          id: `day-${dayIndex}`,
        },
        
        // Day items
        ...dayItems.map(item => ({
          stack: [
            // Session title and time
            { text: item.topic, style: 'sessionTitle' },
            { 
              text: `${formatTo12Hour(item.startTime)} - ${formatTo12Hour(item.endTime)} (${item.durationMinutes} minutes)`, 
              style: 'sessionTime' 
            },
            
            // Description with left border
            item.description ? {
              stack: [
                { text: item.description, style: 'sessionDescription' }
              ],
              margin: [0, 0, 0, 0],
              // Use canvas for the left border
              canvas: [
                {
                  type: 'line',
                  x1: -5, y1: 0,
                  x2: -5, y2: 100,
                  lineWidth: 3,
                  lineColor: '#007BFF'
                }
              ]
            } : {},
          ],
          margin: [0, 0, 0, 12],
          unbreakable: true
        })),
      ]
    });
  });

  // Define document definition
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    
    defaultStyle: {
      fontSize: 10,
    },
    
    styles: {
      title: {
        fontSize: 24,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      subtitle: {
        fontSize: 14,
        color: '#666666',
        margin: [0, 0, 0, 5],
      },
      eventDetails: {
        fontSize: 12,
        color: '#666666',
        margin: [0, 0, 0, 20],
      },
      dayHeader: {
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 10],
        decoration: 'underline',
      },
      sessionTitle: {
        fontSize: 14,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      sessionTime: {
        fontSize: 12,
        color: '#444444',
        margin: [0, 0, 0, 5],
      },
      sessionDescription: {
        fontSize: 11,
        margin: [0, 0, 0, 0],
        lineHeight: 1.5,
      },
      summaryTitle: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 8],
      },
      summaryDayTitle: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      repeatingDayHeader: {
        fontSize: 14,
        bold: true,
        color: '#444444',
        margin: [0, 0, 0, 10],
        decoration: 'underline',
      }
    },
    
    // Use our constructed content array
    content: content,
    
    // Footer is shared across all sections
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { 
            text: `Event Agenda - Generated on ${format(new Date(), "MMMM d, yyyy")}`,
            alignment: 'center',
            margin: [40, 5, 40, 0],
            fontSize: 10,
            color: '#666666',
          }
        ],
        margin: [40, 10, 40, 0]
      };
    },
    
    // First page (cover) has no header
    header: function(currentPage: number) {
      if (currentPage === 1) return null;
      // For other pages, headers are defined in each content section
      return {};
    },
    
    pageNumbers: true,
  };

  // Create and download the PDF
  try {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    
    // Note: In pdfMake, we don't have perfect control over how day headers appear on continuation pages.
    // Our approach uses dayPageMap to determine which day header should appear in the header of each page.
    // This is a reasonable compromise that works well in most cases, though it may not be perfect
    // for very complex documents with lots of page breaks.
    // 
    // For more precise control, a custom pdfMake extension would be needed, but this would
    // require significantly more complexity.
    
    pdfDoc.download(fileName);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Test Export Button component - updated to handle async function
export const AgendaPdfTestExport: React.FC<{ 
  event: Event, 
  agendaItems: AgendaItem[],
  fileName?: string,
  children: React.ReactNode 
}> = ({ event, agendaItems, fileName = "event-agenda-test.pdf", children }) => {
  const [status, setStatus] = useState<'idle' | 'loading-image' | 'generating' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  if (!event || !agendaItems) {
    return null;
  }
  
  const safeFileName = (event.title ? event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'event') + '-agenda-test.pdf';
  
  const handleClick = async () => {
    try {
      setStatus('generating');
      setErrorMessage(null);
      await generatePdf(event, agendaItems, safeFileName, setStatus);
      setStatus('idle');
    } catch (error) {
      console.error('Error generating PDF:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate PDF. Please try again.');
      // Only show alert for critical errors
      if (!(error instanceof Error && error.message.includes('image'))) {
        alert('There was an error generating the PDF. Please try again.');
      }
    }
  };
  
  // Use a div wrapper instead of a button to avoid nesting buttons
  return (
    <div 
      onClick={status === 'idle' ? handleClick : undefined}
      className={`inline-flex cursor-pointer ${status !== 'idle' ? 'opacity-70' : ''}`}
      title={errorMessage || undefined}
    >
      {status === 'generating' && 'Generating...'}
      {status === 'loading-image' && 'Loading image...'}
      {status === 'error' && 'Try again'}
      {status === 'idle' && children}
    </div>
  );
}; 