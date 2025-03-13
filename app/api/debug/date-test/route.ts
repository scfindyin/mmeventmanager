import { NextResponse } from "next/server"
import { formatDate } from "@/lib/utils"

export async function GET() {
  const now = new Date()
  const formattedDate = formatDate(now.toISOString().split('T')[0])
  
  // Create a collection of test date strings to check parsing
  const testDates = [
    "2023-05-15",
    "2025-03-03",
    "2025-03-07",
    "2025-03-12T20:43:02.667768+00:00"
  ]
  
  // Test each date string
  const testResults = testDates.map(dateStr => {
    const date = new Date(dateStr)
    
    // Create a UTC date for comparison
    let utcDate = null
    let utcFormatted = null
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      utcDate = new Date(Date.UTC(year, month - 1, day))
      utcFormatted = utcDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      })
    }
    
    return {
      original: dateStr,
      isValid: !isNaN(date.getTime()),
      parsedIsoString: date.toISOString(),
      parsedDate: date.toString(),
      formattedWithUtils: formatDate(dateStr),
      localeFormatted: date.toLocaleDateString('en-US', {
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      }),
      utcDate: utcDate?.toString() || null,
      utcFormatted: utcFormatted || null
    }
  })
  
  return NextResponse.json({
    currentDate: {
      jsDate: now.toISOString(),
      dbString: now.toISOString().split('T')[0],
      parsedBack: new Date(now.toISOString().split('T')[0]).toISOString(),
      formattedWithUtils: formatDate(now.toISOString().split('T')[0])
    },
    testResults,
    message: "Date conversion working successfully!"
  })
} 