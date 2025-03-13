import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { formatDate, formatTime, formatDateForInput } from "@/lib/utils"
import { dateUtils } from "@/lib/types"

export async function GET() {
  try {
    // Fetch a sample of events from Supabase
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .limit(5)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For each event, add formatted dates for comparison
    const eventsWithFormattedDates = events.map(event => {
      // Safely cast the database values
      const start_date = event.start_date as string;
      const end_date = event.end_date as string;
      const created_at = event.created_at as string;
      const start_time = event.start_time as string;
      const end_time = event.end_time as string;

      // Create a JavaScript Date from the date string for debugging
      const parsedStartDate = new Date(start_date);
      const parsedEndDate = new Date(end_date);
      const parsedCreatedAt = new Date(created_at);
      
      // Test various date formatting approaches for debugging
      const utilsFormatDate = formatDate(start_date);
      const dateUtilsFormat = start_date ? dateUtils.formatDate(new Date(start_date)) : '';
      const dateLocaleFormat = parsedStartDate.toLocaleDateString('en-US');
      const dateISOString = parsedStartDate.toISOString();
      
      // Create a UTC date for comparison
      const [year, month, day] = start_date.split('-').map(Number);
      const utcDate = new Date(Date.UTC(year, month - 1, day));
      const utcFormatted = utcDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
      
      return {
        id: event.id,
        title: event.title,
        raw: {
          start_date,
          end_date,
          created_at,
          start_time,
          end_time,
        },
        parsed_js_dates: {
          start_date: parsedStartDate.toString(),
          end_date: parsedEndDate.toString(),
          created_at: parsedCreatedAt.toString(),
          start_date_iso: dateISOString,
          start_date_locale: dateLocaleFormat,
          start_date_utc: utcDate.toString(),
          start_date_utc_formatted: utcFormatted
        },
        formatted: {
          start_date: utilsFormatDate,
          end_date: formatDate(end_date),
          created_at: created_at ? new Date(created_at).toLocaleString() : null,
          start_time: formatTime(start_time),
          end_time: formatTime(end_time),
        },
        type_info: {
          start_date_type: typeof start_date,
          end_date_type: typeof end_date,
          created_at_type: typeof created_at,
          start_time_type: typeof start_time,
          end_time_type: typeof end_time,
        },
        date_utils_test: {
          utils_format: utilsFormatDate,
          dateUtils_format: dateUtilsFormat,
          formatDateForInput: formatDateForInput(start_date)
        }
      };
    });

    return NextResponse.json({
      message: "Date formats retrieved successfully",
      data: eventsWithFormattedDates,
      utils_version: "Using new formatDate/formatTime from lib/utils.ts",
    })
  } catch (error) {
    console.error("Error fetching date formats:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
} 