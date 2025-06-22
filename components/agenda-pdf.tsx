"use client";

import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import type { AgendaItem, Event } from '@/lib/types';
import { format, addDays } from 'date-fns';

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

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    padding: 40, // Global page padding
    paddingTop: 80, // Extra space for header (increased from 60)
    paddingBottom: 60 // Extra space for footer
  },
  // Header - stays fixed at top
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  // Footer - stays fixed at bottom
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    height: 20,
    textAlign: 'center',
    fontSize: 10,
    color: '#666',
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 5
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 10,
    color: '#666'
  },
  // First page has different styling
  firstPage: {
    padding: 40,
    paddingBottom: 60 // Space for footer
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 0,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE'
  },
  continuedText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#666',
    marginLeft: 8
  },
  dayHeaderContinued: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 4,
    marginBottom: 10,
    marginTop: 0
  },
  firstPageContent: {
    // First page has no header, so no extra top padding needed
    paddingBottom: 60, // Add space for footer
  },
  otherPageContent: {
    // Pages with header need extra space at top
    paddingTop: 40,
    paddingBottom: 60, // Add space for footer
  },
  headerLeft: {
    flexDirection: 'column'
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  headerDetails: {
    fontSize: 10,
    color: '#666'
  },
  headerLogo: {
    width: 80,
    height: 48,
    objectFit: 'contain'
  },
  frontPageLogo: {
    width: 80,
    height: 48,
    objectFit: 'contain',
    marginLeft: 20
  },
  watermark: {
    position: 'absolute',
    width: 417, // Approx 70% of A4 width (595 * 0.7)
    height: 295, // Height based on 70% width and original aspect ratio
    top: 274,    // (842 / 2) - (295 / 2) = 421 - 147.5
    left: 89,     // (595 / 2) - (417 / 2) = 297.5 - 208.5
    opacity: 0.1,
  },
  mainHeader: {
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5
  },
  eventDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20
  },
  agendaItem: {
    marginBottom: 0,
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 10,
    paddingRight: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007BFF'
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4
  },
  itemTime: {
    fontSize: 12,
    color: '#444',
    marginBottom: 3
  },
  itemDescription: {
    fontSize: 11,
    lineHeight: 1.5,
    padding: 0,
    margin: 0
  },
  eventDescription: {
    fontSize: 12,
    marginBottom: 15,
    lineHeight: 1.4
  },
  summarySection: {
    marginBottom: 30,
    borderTop: '1px solid #eee',
    paddingTop: 10
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8
  },
  summaryDay: {
    marginBottom: 12
  },
  summaryDayTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5
  },
  summaryItems: {
    marginLeft: 15
  },
  summaryItem: {
    fontSize: 10,
    marginBottom: 4,
    display: 'flex',
    flexDirection: 'row'
  },
  summaryTime: {
    width: 120,
    fontFamily: 'Courier', // Monospaced font for better alignment
  },
  summaryTopic: {
    flex: 1
  },
  sessionHeader: {
    marginBottom: 4,
    marginTop: 6,
    padding: 0
  },
  frontPageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  titleSection: {
    flex: 1,
    flexDirection: 'column'
  },
});

// Main PDF Document component
const AgendaPdfDocument = ({ event, agendaItems }: { event: Event, agendaItems: AgendaItem[] }) => {
  // Safety check: ensure all required data is valid before rendering
  if (!event || !agendaItems || !Array.isArray(agendaItems)) {
    console.warn('AgendaPdfDocument: Invalid data provided, skipping render');
    return null;
  }

  // Additional safety check: ensure all items have required fields
  const hasValidItems = agendaItems.every(item => 
    item && 
    typeof item.id === 'string' && 
    typeof item.dayIndex === 'number' &&
    typeof item.order === 'number'
  );

  if (!hasValidItems) {
    console.warn('AgendaPdfDocument: Some agenda items have invalid data, skipping render');
    return null;
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
      // Check for other possible formats
      else if ((event as any).startDateString) {
        startDate = new Date((event as any).startDateString);
      }
      else if ((event as any).parsedStartDate) {
        startDate = new Date((event as any).parsedStartDate);
      }
      
      if (startDate) {
        const currentDate = addDays(startDate, dayIndex);
        return format(currentDate, "MMMM d, yyyy");
      }
      
      console.error("No valid start date found in event:", event);
      return null;
    } catch (error) {
      console.error("Error formatting day date:", error);
      return null;
    }
  };

  // Format event date range
  const eventDateRange = (() => {
    // First try standard camelCase properties
    if (event.startDate && event.endDate) {
      return `${format(new Date(event.startDate), "MMMM d, yyyy")} - ${format(new Date(event.endDate), "MMMM d, yyyy")}`;
    }
    
    // Then try snake_case properties
    if ((event as any).start_date && (event as any).end_date) {
      return `${format(new Date((event as any).start_date), "MMMM d, yyyy")} - ${format(new Date((event as any).end_date), "MMMM d, yyyy")}`;
    }
    
    // Then try startDateString/endDateString
    if ((event as any).startDateString && (event as any).endDateString) {
      return `${format(new Date((event as any).startDateString), "MMMM d, yyyy")} - ${format(new Date((event as any).endDateString), "MMMM d, yyyy")}`;
    }
    
    // If all else fails
    return "Date not specified";
  })();

  // Log what we found to help debug
  console.log("Event dates found:", { 
    camelCase: event.startDate && event.endDate, 
    snake_case: (event as any).start_date && (event as any).end_date,
    dateString: (event as any).startDateString && (event as any).endDateString
  });

  // Instead of using onRender, we'll create a simpler tracking mechanism
  // Each day will track if it has been rendered already in this Map
  // We're using a ref so it persists across renders but doesn't trigger rerenders
  const dayStartPages = React.useRef<Map<number, number>>(new Map());
  
  return (
    <Document>
      {/* First page with overview */}
      <Page size="A4" style={styles.firstPage}>
        {/* Watermark - fixed so it appears on all pages */}
        {event.logo_url && (
          <Image src={event.logo_url} style={styles.watermark} fixed />
        )}
        
        <View style={styles.mainHeader}>
          {/* Header with logo inline */}
          <View style={styles.frontPageHeader}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>{event.title}</Text>
              {event.subtitle && (
                <Text style={styles.subtitle}>{event.subtitle}</Text>
              )}
            </View>
            {event.logo_url && (
              <Image src={event.logo_url} style={styles.frontPageLogo} />
            )}
          </View>
          
          <Text style={styles.eventDetails}>
            {eventDateRange}
            {event.startDate && Object.keys(event.hoursOfOperation || {}).length > 0 ? 
              ` • ${formatTo12Hour(
                Object.values(event.hoursOfOperation)[0]?.startTime || "00:00"
              )} - ${formatTo12Hour(
                Object.values(event.hoursOfOperation)[0]?.endTime || "00:00"
              )}` : 
              ""}
            {` • ${agendaItems.length} agenda items`}
          </Text>
          
          {/* Event description */}
          {(event as any).description && (
            <Text style={styles.eventDescription}>{(event as any).description}</Text>
          )}
          
          {/* Summary of all agenda items */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Agenda Overview</Text>
            
            {sortedDays.map(dayIndex => {
              const formattedDate = formatDayDate(dayIndex);
              return (
                <View key={`summary-day-${dayIndex}`} style={styles.summaryDay}>
                  <Text style={styles.summaryDayTitle}>
                    Day {dayIndex + 1}{formattedDate ? ` - ${formattedDate}` : ''}
                  </Text>
                  <View style={styles.summaryItems}>
                    {itemsByDay[dayIndex]
                      .sort((a, b) => a.order - b.order)
                      .map(item => (
                        <View key={`summary-item-${item.id}`} style={styles.summaryItem}>
                          <Text style={styles.summaryTime}>
                            {formatTo12Hour(item.startTime || '')} - {formatTo12Hour(item.endTime || '')}
                          </Text>
                          <Text style={styles.summaryTopic}>
                            {item.topic || ''}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Footer with page number */}
        <View fixed style={styles.footer}>
          <Text>{`Event Agenda - Generated on ${format(new Date(), "MMMM d, yyyy")}`}</Text>
        </View>
        
        <Text 
          fixed 
          style={styles.pageNumber} 
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} 
        />
      </Page>

      {/* Create separate pages for each day's detailed agenda */}
      {sortedDays.map((dayIndex, dayOrderIndex) => {
        const formattedDate = formatDayDate(dayIndex);
        const dayTitle = `Day ${dayIndex + 1}${formattedDate ? ` - ${formattedDate}` : ''}`;
        
        // Get items for this day
        const dayItems = itemsByDay[dayIndex].sort((a, b) => a.order - b.order);
        
        // For each day, we create a separate page
        return (
          <Page 
            key={`day-detail-${dayIndex}`}
            size="A4"
            style={styles.page}
          >
            {/* Watermark for subsequent pages */}
            {event.logo_url && (
              <Image src={event.logo_url} style={styles.watermark} fixed />
            )}
            
            {/* Header - fixed at top */}
            <View fixed style={styles.pageHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>{event.title}</Text>
                <Text style={styles.headerDetails}>{eventDateRange}</Text>
              </View>
              {event.logo_url && (
                <Image src={event.logo_url} style={styles.headerLogo} />
              )}
            </View>

            {/* Day title */}
            <Text style={styles.dayHeader}>{dayTitle}</Text>
            
            {/* Items for this day */}
            {dayItems.map(item => (
              <View key={item.id} wrap={false} style={{ marginBottom: 12 }}>
                {/* Session header without left border */}
                <View style={styles.sessionHeader}>
                  <Text style={styles.itemTitle}>{item.topic || ''}</Text>
                  <Text style={styles.itemTime}>
                    {formatTo12Hour(item.startTime || '')} - {formatTo12Hour(item.endTime || '')}
                    {` (${item.durationMinutes} minutes)`}
                  </Text>
                </View>

                {/* Description content with left border */}
                <View style={styles.agendaItem}>
                  <Text style={styles.itemDescription}>{item.description || ''}</Text>
                </View>
              </View>
            ))}
            
            {/* Footer - fixed at bottom */}
            <View fixed style={styles.footer}>
              <Text>{`Event Agenda - Generated on ${format(new Date(), "MMMM d, yyyy")}`}</Text>
            </View>
            
            <Text 
              fixed 
              style={styles.pageNumber} 
              render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} 
            />
          </Page>
        );
      })}
    </Document>
  );
};

// Export component that generates PDF only when clicked
export const AgendaPdfDownload = ({ 
  event,
  agendaItems,
  fileName = "event-agenda.pdf",
  children
}: { 
  event: Event, 
  agendaItems: AgendaItem[],
  fileName?: string,
  children: React.ReactNode
}) => {
  if (!event || !agendaItems) {
    return null;
  }
  
  const safeFileName = (event.title ? event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'event') + '-agenda.pdf';
  
  const handleExport = async () => {
    // Import react-pdf dynamically only when needed
    const { pdf } = await import('@react-pdf/renderer');
    
    // Create the PDF document with current data
    const blob = await pdf(<AgendaPdfDocument event={event} agendaItems={agendaItems} />).toBlob();
    
    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div onClick={handleExport}>
      {children}
    </div>
  );
};

// Fix the exports to ensure AgendaPdfDownload is properly exported
export { AgendaPdfDocument };