"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Plus, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase, type Attendee } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface AttendeeListProps {
  eventId: string
}

export function AttendeeList({ eventId }: AttendeeListProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // First, add state for editing an attendee
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")

  useEffect(() => {
    fetchAttendees()
  }, [eventId])

  async function fetchAttendees() {
    try {
      setIsLoading(true)
      const { data, error } = await supabase.from("attendees").select("*").eq("event_id", eventId).order("name")

      if (error) throw error
      setAttendees(data || [])
    } catch (error: any) {
      toast({
        title: "Error fetching attendees",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function addAttendee() {
    if (!newName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a name for the attendee.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const { error } = await supabase.from("attendees").insert({
        event_id: eventId,
        name: newName.trim(),
        email: newEmail.trim() || null,
      })

      if (error) throw error

      // Clear the form fields
      setNewName("")
      setNewEmail("")

      // Fetch updated attendees
      fetchAttendees()

      toast({
        title: "Attendee added",
        description: "The attendee has been added successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error adding attendee",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add this function to handle editing an attendee
  async function editAttendee() {
    if (!editingAttendee) return

    if (!editName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide at least a name for the attendee.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const { error } = await supabase
        .from("attendees")
        .update({
          name: editName.trim(),
          email: editEmail.trim() || null,
        })
        .eq("id", editingAttendee.id)

      if (error) throw error

      // Clear the editing state
      setEditingAttendee(null)
      setEditName("")
      setEditEmail("")

      // Fetch updated attendees
      fetchAttendees()

      toast({
        title: "Attendee updated",
        description: "The attendee has been updated successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error updating attendee",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle key press for accessibility
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingAttendee) {
        editAttendee()
      } else {
        addAttendee()
      }
    }
  }

  // Modify the removeAttendee function to prevent navigation issues
  async function removeAttendee(id: string) {
    try {
      const { error } = await supabase.from("attendees").delete().eq("id", id)

      if (error) throw error

      // Update the local state instead of refetching to prevent navigation issues
      setAttendees(attendees.filter((a) => a.id !== id))

      toast({
        title: "Attendee removed",
        description: "The attendee has been removed successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Error removing attendee",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // Add a function to start editing an attendee
  function startEditing(attendee: Attendee) {
    setEditingAttendee(attendee)
    setEditName(attendee.name)
    setEditEmail(attendee.email || "")
  }

  return (
    <div className="space-y-4">
      {editingAttendee ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            placeholder="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                editAttendee()
              }
            }}
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                editAttendee()
              }
            }}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={editAttendee} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingAttendee(null)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={handleKeyPress}
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1"
            onKeyDown={handleKeyPress}
          />
          <Button type="button" onClick={addAttendee} disabled={isSubmitting}>
            <Plus className="mr-2 h-4 w-4" />
            {isSubmitting ? "Adding..." : "Add"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4">Loading attendees...</div>
      ) : attendees.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">No attendees added yet</div>
      ) : (
        <div className="border rounded-md">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <tr key={attendee.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{attendee.name}</td>
                  <td className="px-4 py-2">{attendee.email || "-"}</td>
                  <td className="px-4 py-2 flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEditing(attendee)}>
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
                        className="lucide lucide-pencil"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeAttendee(attendee.id)}>
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

