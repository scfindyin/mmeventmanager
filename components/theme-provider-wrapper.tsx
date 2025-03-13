"use client"

import type React from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"

export function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="event-agenda-theme">
      {children}
      <div className="fixed bottom-4 right-4">
        <ThemeToggle />
      </div>
    </ThemeProvider>
  )
}

