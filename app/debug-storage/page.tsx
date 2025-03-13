"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

export default function DebugStoragePage() {
  const [logs, setLogs] = useState<string[]>([])
  const [buckets, setBuckets] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [selectedBucket, setSelectedBucket] = useState("event-assets")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const addLog = (message: string) => {
    console.log(message)
    setLogs((prev) => [...prev, `${new Date().toISOString().split("T")[1].split(".")[0]} - ${message}`])
  }

  useEffect(() => {
    fetchBuckets()
  }, [])

  useEffect(() => {
    if (selectedBucket) {
      fetchFiles(selectedBucket)
    }
  }, [selectedBucket])

  const fetchBuckets = async () => {
    try {
      addLog("Fetching buckets...")
      const { data, error } = await supabase.storage.listBuckets()

      if (error) {
        addLog(`Error fetching buckets: ${error.message}`)
        return
      }

      addLog(`Found ${data.length} buckets`)
      setBuckets(data)

      // Check if event-assets bucket exists
      const eventAssetsBucket = data.find((b) => b.name === "event-assets")
      if (!eventAssetsBucket) {
        addLog("event-assets bucket not found, creating...")
        await createEventAssetsBucket()
      } else {
        addLog(`event-assets bucket found, public: ${eventAssetsBucket.public}`)
        if (!eventAssetsBucket.public) {
          addLog("Making event-assets bucket public...")
          await makeEventAssetsBucketPublic()
        }
      }
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const createEventAssetsBucket = async () => {
    try {
      // Try with regular client first
      try {
        const { data, error } = await supabase.storage.createBucket("event-assets", {
          public: true,
        })

        if (error) {
          addLog(`Regular client error: ${error.message}`)
          throw error
        }

        addLog("Bucket created successfully with regular client")
        return
      } catch (error) {
        addLog(`Trying with admin client...`)
      }

      // Try with API route
      const response = await fetch("/api/setup-storage")
      const result = await response.json()

      if (result.success) {
        addLog("Bucket created successfully via API")
      } else {
        addLog(`API error: ${result.error}`)
      }
    } catch (error) {
      addLog(`Error creating bucket: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const makeEventAssetsBucketPublic = async () => {
    try {
      // Try with regular client first
      try {
        const { data, error } = await supabase.storage.updateBucket("event-assets", {
          public: true,
        })

        if (error) {
          addLog(`Regular client error: ${error.message}`)
          throw error
        }

        addLog("Bucket updated successfully with regular client")
        return
      } catch (error) {
        addLog(`Trying with admin client...`)
      }

      // Try with API route
      const response = await fetch("/api/setup-storage")
      const result = await response.json()

      if (result.success) {
        addLog("Bucket updated successfully via API")
      } else {
        addLog(`API error: ${result.error}`)
      }
    } catch (error) {
      addLog(`Error updating bucket: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const fetchFiles = async (bucket: string) => {
    try {
      addLog(`Fetching files from ${bucket}...`)
      const { data, error } = await supabase.storage.from(bucket).list()

      if (error) {
        addLog(`Error fetching files: ${error.message}`)
        return
      }

      addLog(`Found ${data.length} files/folders`)
      setFiles(data)
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleFileSelect = async (path: string) => {
    try {
      setSelectedFile(path)
      addLog(`Selected file: ${path}`)

      // Get public URL
      const { data } = supabase.storage.from(selectedBucket).getPublicUrl(path)
      setFileUrl(data.publicUrl)
      addLog(`Public URL: ${data.publicUrl}`)
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    addLog(`File selected for upload: ${selectedFile.name}`)
  }

  const handleUpload = async () => {
    if (!file) {
      addLog("No file selected")
      return
    }

    setLoading(true)
    addLog(`Uploading ${file.name} to ${selectedBucket}...`)

    try {
      // Upload via API route
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload-simple", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Upload failed")
      }

      addLog(`Upload successful: ${result.publicUrl}`)
      setFileUrl(result.publicUrl)

      // Refresh file list
      fetchFiles(selectedBucket)
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Storage Debugger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Buckets</h3>
              <div className="border rounded-md p-2 h-40 overflow-auto">
                {buckets.length === 0 ? (
                  <p className="text-muted-foreground">No buckets found</p>
                ) : (
                  <ul className="space-y-1">
                    {buckets.map((bucket) => (
                      <li
                        key={bucket.id}
                        className={`p-2 rounded cursor-pointer ${selectedBucket === bucket.name ? "bg-muted" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedBucket(bucket.name)}
                      >
                        {bucket.name} {bucket.public ? "(public)" : "(private)"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">Files in {selectedBucket}</h3>
              <div className="border rounded-md p-2 h-40 overflow-auto">
                {files.length === 0 ? (
                  <p className="text-muted-foreground">No files found</p>
                ) : (
                  <ul className="space-y-1">
                    {files.map((file) => (
                      <li
                        key={file.id}
                        className={`p-2 rounded cursor-pointer ${selectedFile === file.name ? "bg-muted" : "hover:bg-muted/50"}`}
                        onClick={() => handleFileSelect(file.name)}
                      >
                        {file.name} {file.metadata?.mimetype && `(${file.metadata.mimetype})`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Upload File</h3>
                <div className="flex gap-2">
                  <Input type="file" onChange={handleFileChange} disabled={loading} />
                  <Button onClick={handleUpload} disabled={!file || loading}>
                    {loading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">File Preview</h3>
              {fileUrl ? (
                <div className="space-y-2">
                  <p className="text-sm break-all bg-muted p-2 rounded">{fileUrl}</p>
                  <div className="border rounded-md p-4 flex justify-center">
                    <img
                      src={`${fileUrl}?v=${Date.now()}`}
                      alt="Selected file"
                      className="max-h-60 object-contain"
                      onError={() => addLog("Image failed to load")}
                      onLoad={() => addLog("Image loaded successfully")}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.open(fileUrl, "_blank")}>
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const img = new Image()
                        img.onload = () => addLog("Image loaded in JS test")
                        img.onerror = () => addLog("Image failed to load in JS test")
                        img.src = `${fileUrl}?v=${Date.now()}`
                      }}
                    >
                      Test Load in JS
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-md p-4 h-60 flex items-center justify-center">
                  <p className="text-muted-foreground">Select a file to preview</p>
                </div>
              )}

              <h3 className="text-lg font-medium mt-4 mb-2">Logs</h3>
              <div className="bg-muted p-2 rounded h-40 overflow-auto text-xs font-mono">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

