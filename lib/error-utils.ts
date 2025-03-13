/**
 * Extracts a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  if (typeof error === "object" && error !== null) {
    // Try to extract message from Supabase error format
    if ("message" in error && typeof error.message === "string") {
      return error.message
    }

    // Try to extract error from response error format
    if ("error" in error && typeof error.error === "string") {
      return error.error
    }

    // Return stringified object as last resort
    try {
      return JSON.stringify(error)
    } catch {
      return "Unknown error object"
    }
  }

  return "An unknown error occurred"
}

/**
 * Determines if an error is related to database columns
 */
export function isColumnError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return message.includes("column") && message.includes("does not exist")
}

/**
 * Determines if an error is related to row-level security
 */
export function isRLSError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return message.includes("row-level security") || message.includes("permission denied") || message.includes("policy")
}

