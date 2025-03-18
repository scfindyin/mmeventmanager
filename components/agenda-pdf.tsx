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
    fontFamily: 'Helvetica'
    // No padding here - we'll control each section precisely
  },
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    height: 30, // Fixed height for header
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  contentArea: {
    position: 'absolute',
    top: 70, // Below the page header
    left: 40,
    right: 40,
    bottom: 70, // Above the footer
  },
  // First page has no header, so more space for content
  firstPageContentArea: {
    position: 'absolute',
    top: 40,
    left: 40,
    right: 40,
    bottom: 70, // Above the footer
  },
  dayContainer: {
    marginBottom: 10
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    padding: 8,
    marginBottom: 0, // Remove bottom margin completely
    marginTop: 0
  },
  continuedText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#666',
    marginLeft: 5,
    alignSelf: 'flex-end', // Align to bottom
    paddingBottom: 2 // Fine-tune vertical alignment
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
    width: 50,
    height: 30,
    objectFit: 'contain'
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
    marginBottom: 20, // Increase from 15px to 20px for more separation
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007BFF',
    breakInside: 'avoid'
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5 // Increase from 3px to 5px
  },
  itemTime: {
    fontSize: 12,
    color: '#444',
    marginBottom: 5
  },
  itemDescription: {
    fontSize: 11,
    lineHeight: 1.4 // Add line height for better readability
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
  }
});

// Main PDF Document component
const AgendaPdfDocument = ({ event, agendaItems }: { event: Event, agendaItems: AgendaItem[] }) => {
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
      <Page size="A4" style={styles.page}>
        {/* Main title section */}
        <View style={styles.firstPageContentArea}>
          <View style={styles.mainHeader}>
            <Text style={styles.title}>{event.title}</Text>
            {event.subtitle && (
              <Text style={styles.subtitle}>{event.subtitle}</Text>
            )}
            <Text style={styles.eventDetails}>
              {eventDateRange}
              {/* Access hoursOfOperation for the start/end times if available */}
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
                              {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)}
                            </Text>
                            <Text style={styles.summaryTopic}>
                              {item.topic}
                            </Text>
                          </View>
                        ))}
                    </View>
                  </View>
                );
              })}
            </View>
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
            {/* Header that appears on every detail page */}
            <View fixed style={styles.pageHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>{event.title}</Text>
                <Text style={styles.headerDetails}>{eventDateRange}</Text>
              </View>
              {event.logo_url && (
                <Image src={event.logo_url} style={styles.headerLogo} />
              )}
            </View>

            {/* Content area - safe zone below header and above footer */}
            <View fixed style={styles.contentArea}>
              {/* Day header with conditional (continued) indicator */}
              <View fixed>
                <View render={({ pageNumber }) => {
                  // Check if this is the first page for this day
                  // If we haven't seen this day before, it's the first page
                  if (!dayStartPages.current.has(dayIndex)) {
                    dayStartPages.current.set(dayIndex, pageNumber);
                  }
                  
                  // It's the first page if the current pageNumber matches what we stored
                  const isFirstPageForDay = pageNumber === dayStartPages.current.get(dayIndex);
                  
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                      <Text style={styles.dayHeader}>{dayTitle}</Text>
                      {!isFirstPageForDay && (
                        <Text style={styles.continuedText}>(continued)</Text>
                      )}
                    </View>
                  );
                }} />
              </View>
              
              {/* Items for this day */}
              <View style={{ marginTop: 15 }}> {/* Increase from 5px to 15px for more space below header */}
                {dayItems.map((item, index) => (
                  <View key={item.id} style={styles.agendaItem} wrap={false}>
                    <Text style={styles.itemTitle}>{item.topic}</Text>
                    <Text style={styles.itemTime}>
                      {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)} 
                      {` (${item.durationMinutes} minutes)`}
                    </Text>
                    {item.description && (
                      <Text style={styles.itemDescription}>{item.description}</Text>
                    )}
                  </View>
                ))}
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
        );
      })}
    </Document>
  );
};

// Export component with PDFDownloadLink wrapper
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
  
  return (
    <PDFDownloadLink
      document={<AgendaPdfDocument event={event} agendaItems={agendaItems} />}
      fileName={safeFileName}
    >
      {({ loading }) => loading ? 'Preparing PDF...' : children}
    </PDFDownloadLink>
  );
}; 