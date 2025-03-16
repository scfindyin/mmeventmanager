const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://yeqdapkrkrboaqwvzbdu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllcWRhcGtya3Jib2Fxd3Z6YmR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4MDU1MjUsImV4cCI6MjA1NzM4MTUyNX0.6x3OKBk-TlmZln7ktr3GqNNKSb2HWdf4PQFIpA5nJx8'
)

async function testConnection() {
  try {
    // Try to fetch a single row from agenda_items
    const { data, error } = await supabase
      .from('agenda_items')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error:', error.message)
      return
    }
    
    console.log('Successfully connected to Supabase!')
    console.log('Sample data:', data)
  } catch (err) {
    console.error('Unexpected error:', err)
  }
}

testConnection() 