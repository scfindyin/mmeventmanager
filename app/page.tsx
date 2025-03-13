import { EventDashboard } from "@/components/event-dashboard"
import { createSetupFunctions } from "@/lib/setup-functions"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

// This is a server component, so we can run setup code here
export default async function Home() {
  // Check if Supabase environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  let setupError = null;
  let missingEnvVars = false;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://example.supabase.co') {
    missingEnvVars = true;
  } else {
    try {
      // Try to create the setup functions in Supabase
      await createSetupFunctions()
    } catch (error) {
      console.error("Error in setup:", error)
      setupError = error;
      // Continue with the app even if setup fails
      // The dashboard will handle showing setup UI if needed
    }
  }

  try {
    if (missingEnvVars) {
      return (
        <div className="container mx-auto py-8">
          <h1 className="text-4xl font-bold mb-6">Event Agenda Manager</h1>
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing Supabase Configuration</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Please update your <code className="bg-gray-100 px-1 py-0.5 rounded">.env.local</code> file with your Supabase credentials.
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Log in to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase Dashboard</a></li>
                <li>Select your project or create a new one</li>
                <li>Go to Project Settings &gt; API</li>
                <li>Copy the "Project URL" and "anon/public" API key</li>
                <li>Update the .env.local file with these values</li>
                <li>Restart the development server</li>
              </ol>
            </AlertDescription>
          </Alert>
          <HomePageContent />
        </div>
      );
    }
    
    if (setupError) {
      return (
        <div className="container mx-auto py-8">
          <h1 className="text-4xl font-bold mb-6">Event Agenda Manager</h1>
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Supabase Setup Error</AlertTitle>
            <AlertDescription>
              <p className="mb-2">There was an error setting up the Supabase database:</p>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {setupError instanceof Error ? setupError.message : String(setupError)}
              </pre>
              <p className="mt-2">Please check your Supabase configuration and permissions.</p>
            </AlertDescription>
          </Alert>
          <HomePageContent />
        </div>
      );
    }
    
    return (
      <main className="min-h-screen p-4 md:p-6 lg:p-8">
        <EventDashboard />
      </main>
    )
  } catch (error) {
    console.error("Error rendering main page:", error);
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-4xl font-bold mb-4">Event Agenda Manager</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">There was an error loading the dashboard.</p>
          <p>Please try the debug tools below to help diagnose the issue.</p>
        </div>
        <HomePageContent />
      </div>
    );
  }
}

function HomePageContent() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8">Event Agenda Manager</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Manage your events and agendas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Create and manage event schedules</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/admin">Manage Events</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Tools</CardTitle>
            <CardDescription>Troubleshooting utilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Tools for debugging and testing</p>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="mr-2">
              <Link href="/debug">Debug Page</Link>
            </Button>
            <Button variant="outline" asChild className="mr-2">
              <Link href="/debug-storage">Storage Debug</Link>
            </Button>
            <Button variant="outline" asChild className="mr-2">
              <Link href="/api/debug/date-test">API Date Test</Link>
            </Button>
            <Button variant="outline" asChild className="mr-2">
              <Link href="/date-test">Date Test UI</Link>
            </Button>
            <Button variant="outline" asChild className="mr-2">
              <Link href="/date-formats">Date Formats Debug</Link>
            </Button>
            <Button variant="outline" asChild className="mr-2">
              <Link href="/debug/supabase-connection">Supabase Connection</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/debug/schema-inspector">Schema Inspector</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

