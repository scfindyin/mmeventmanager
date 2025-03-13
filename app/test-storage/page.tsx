"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

export default function TestStoragePage() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toISOString().split("T")[1].split(".")[0]} - ${message}`])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    addLog(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size} bytes)`)

    // Create a preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setLoading(true)
    setError(null)
    addLog("Starting upload...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      addLog("Sending request to /api/upload-logo")
      const response = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      addLog(`Upload successful: ${result.publicUrl}`)
      setUploadedUrl(result.publicUrl)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      addLog(`Error: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test Storage Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            {preview && (
              <div className="relative w-64 h-64 mb-4">
                <Image src={preview || "/placeholder.svg"} alt="Preview" fill className="object-contain" />
              </div>
            )}
            <div className="flex items-center gap-2 w-full">
              <Input type="file" accept="image/*" onChange={handleFileChange} disabled={loading} />
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-800 rounded-md">{error}</div>}

          {uploadedUrl && (
            <div className="space-y-2">
              <h3 className="font-medium">Uploaded Successfully:</h3>
              <div className="p-2 bg-gray-100 rounded break-all">
                <a
                  href={uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {uploadedUrl}
                </a>
              </div>
              <div className="relative w-full h-64">
                <Image src={uploadedUrl || "/placeholder.svg"} alt="Uploaded image" fill className="object-contain" />
              </div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="font-medium mb-2">Logs:</h3>
            <div className="p-4 bg-gray-100 rounded-md h-64 overflow-auto font-mono text-sm">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

