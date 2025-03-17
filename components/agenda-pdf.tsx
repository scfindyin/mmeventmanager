import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Image } from '@react-pdf/renderer';
import type { AgendaItem, Event } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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

// Create StyleSheet using the proper API
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    paddingTop: 80, // Make room for the header
    fontFamily: 'Helvetica'
  },
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    paddingBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  coverLogo: {
    height: 125,
    marginRight: 20,
    marginBottom: 10
  },
  titleSection: {
    flex: 1,
    minWidth: 200
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5
  },
  eventDetails: {
    fontSize: 12,
    color: '#666'
  },
  eventDescription: {
    fontSize: 12,
    color: '#666'
  },
  summarySection: {
    marginBottom: 20
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  summaryDay: {
    marginBottom: 10
  },
  summaryDayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5
  },
  summaryItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  summaryItem: {
    flexDirection: 'column'
  },
  summaryTime: {
    fontSize: 12,
    color: '#666'
  },
  summaryTopic: {
    fontSize: 12,
    color: '#666'
  },
  dayContainer: {
    marginBottom: 20
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  agendaItem: {
    marginBottom: 10
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5
  },
  itemTime: {
    fontSize: 12,
    color: '#666'
  },
  itemDescription: {
    fontSize: 12,
    color: '#666'
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pageNumber: {
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
    if (!event.startDate) return "Date not available";
    
    try {
      const startDate = new Date(event.startDate);
      const currentDate = addDays(startDate, dayIndex);
      return format(currentDate, "MMMM d, yyyy");
    } catch (error) {
      console.error("Error formatting day date:", error);
      return "Date not available";
    }
  };

  // Format event date range
  const eventDateRange = event.startDate && event.endDate
    ? `${format(new Date(event.startDate), "MMMM d, yyyy")} - ${format(new Date(event.endDate), "MMMM d, yyyy")}`
    : "Date range not available";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header that appears on every page EXCEPT the first */}
        <View fixed render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={styles.pageHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{event.title}</Text>
              <Text style={styles.headerDetails}>{eventDateRange}</Text>
            </View>
            {event.logo_url && (
              <Image src={event.logo_url} style={styles.headerLogo} />
            )}
          </View>
        ) : null} />

        {/* Main title section (first page only) */}
        <View style={styles.mainHeader} wrap={false}>
          {/* Logo on the left side */}
          {event.logo_url && (
            <Image 
              src={event.logo_url} 
              style={styles.coverLogo} 
            />
          )}
          
          {/* Title and subtitle */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{event.title}</Text>
            {event.subtitle && (
              <Text style={styles.subtitle}>{event.subtitle}</Text>
            )}
            <Text style={styles.eventDetails}>
              {eventDateRange}
              {/* Access hoursOfOperation for the start/end times if available */}
              {event.startDate && Object.keys(event.hoursOfOperation || {}).length > 0 ? 
                ` • ${formatTo12Hour(
                  Object.values(event.hoursOfOperation)[0]?.startTime || "08:00"
                )} - ${formatTo12Hour(
                  Object.values(event.hoursOfOperation)[0]?.endTime || "17:00"
                )}` : 
                ""}
              {` • ${agendaItems.length} agenda items`}
            </Text>
          </View>
          
          {/* Event description */}
          {(event as any).description && (
            <Text style={styles.eventDescription}>{(event as any).description}</Text>
          )}
        </View>
          
        {/* Summary of all agenda items */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Agenda Overview</Text>
          
          {sortedDays.map(dayIndex => {
            const formattedDate = formatDayDate(dayIndex);
            return (
              <View key={`summary-day-${dayIndex}`} style={styles.summaryDay}>
                <Text style={styles.summaryDayTitle}>
                  Day {dayIndex + 1} - {formattedDate}
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

        {/* Agenda Items by Day - each day kept together */}
        {sortedDays.map((dayIndex, dayArrayIndex) => {
          const formattedDate = formatDayDate(dayIndex);
          return (
            <View key={dayIndex} style={styles.dayContainer} break>
              <Text style={styles.dayHeader}>
                Day {dayIndex + 1} - {formattedDate}
              </Text>
              
              {itemsByDay[dayIndex]
                .sort((a, b) => a.order - b.order)
                .map(item => (
                  <View key={item.id} style={styles.agendaItem}>
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
          );
        })}

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
    </Document>
  );
};

export const AgendaPdfDownload = ({ event, agendaItems }: { event: Event; agendaItems: AgendaItem[] }) => {
  return (
    <PDFDownloadLink 
      document={<AgendaPdfDocument event={event} agendaItems={agendaItems} />} 
      fileName={`${event.title.replace(/\s+/g, "_")}_Agenda.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <Button disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      )}
    </PDFDownloadLink>
  );
};

export default AgendaPdfDocument; 