import { jsPDF } from "jspdf"
import type autoTable from "jspdf-autotable"
import { type Event, type AgendaItem, supabase } from "@/lib/supabase"
import { formatDate } from "@/lib/utils"

// Add the autoTable type to jsPDF
declare module "jspdf" {
  interface jsPDF {
    autoTable: typeof autoTable
  }
}

export async function generatePDF(event: Event, agendaItems: AgendaItem[]) {
  // Create a new PDF document
  const doc = new jsPDF()

  // Add logo if available
  if (event.logo_url) {
    try {
      const img = new Image()
      img.crossOrigin = "anonymous"

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = event.logo_url!
      })

      // Calculate aspect ratio to maintain proportions
      const imgWidth = 40
      const imgHeight = (img.height * imgWidth) / img.width

      doc.addImage(img, "PNG", 15, 10, imgWidth, imgHeight)
    } catch (error) {
      console.error("Error loading logo:", error)
    }
  }

  // Add event title
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text(event.title, 105, 20, { align: "center" })

  // Add subtitle if available
  if (event.secondary_title) {
    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.text(event.secondary_title, 105, 30, { align: "center" })
  }

  // Add date range
  doc.setFontSize(12)
  doc.text(`${formatDate(event.start_date)} - ${formatDate(event.end_date)}`, 105, 40, { align: "center" })

  // Add a line separator
  doc.line(15, 45, 195, 45)

  // Group items by day
  const itemsByDay: Record<number, AgendaItem[]> = {}
  agendaItems.forEach((item) => {
    if (!itemsByDay[item.day_index]) {
      itemsByDay[item.day_index] = []
    }
    itemsByDay[item.day_index].push(item)
  })

  // Sort days
  const sortedDays = Object.keys(itemsByDay)
    .map(Number)
    .sort((a, b) => a - b)

  let yPos = 55

  // Process each day
  for (const dayIndex of sortedDays) {
    // Check if we need to add a new page
    if (yPos > 270) {
      doc.addPage()
      yPos = 20
    }

    // Add day header
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(`Day ${dayIndex + 1}`, 15, yPos)
    yPos += 10

    // Get items for this day
    const dayItems = itemsByDay[dayIndex].sort((a, b) => a.position - b.position)

    // Prepare table data
    const tableData = []

    // For each agenda item
    for (const item of dayItems) {
      // Get sub-items
      const { data: subItems } = await supabase
        .from("sub_items")
        .select("*")
        .eq("agenda_item_id", item.id)
        .order("position")

      // Format sub-items
      let subItemsText = ""
      if (subItems && subItems.length > 0) {
        subItemsText = subItems.map((si) => `• ${si.content}`).join("\n")
      }

      // Add to table data
      tableData.push([`${item.start_time} - ${item.end_time}`, item.duration, item.topic, subItemsText])
    }

    // Add table
    doc.autoTable({
      startY: yPos,
      head: [["Time", "Duration", "Topic", "Details"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 60 },
        3: { cellWidth: 70 },
      },
      didDrawPage: (data) => {
        // Update yPos for next section
        yPos = data.cursor.y + 15
      },
    })
  }

  // Add notes if available
  if (event.notes) {
    // Check if we need to add a new page
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Notes", 15, yPos)
    yPos += 10

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")

    // Split notes into lines to fit the page width
    const splitNotes = doc.splitTextToSize(event.notes, 180)
    doc.text(splitNotes, 15, yPos)
  }

  // Save the PDF
  doc.save(`${event.title.replace(/\s+/g, "_")}_Agenda.pdf`)
}

