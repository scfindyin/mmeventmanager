"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database, Table, ArrowRight, Loader2 } from "lucide-react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TableInfo = {
  table_name: string;
}

type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

type PrimaryKeyInfo = {
  column_name: string;
}

type ForeignKeyInfo = {
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

type TableSchema = {
  name: string;
  columns: {
    name: string;
    type: string;
    is_nullable: boolean;
    is_primary: boolean;
    default_value: string | null;
    foreign_key?: {
      table: string;
      column: string;
    }
  }[];
  row_count?: number;
  sample_data?: Record<string, any>[];
}

export default function SchemaInspectorPage() {
  const [tables, setTables] = useState<TableSchema[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inspectSchema = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Get list of tables 
      const { data: tableList, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .not('table_name', 'like', 'pg_%')
        .not('table_name', 'like', '_prisma_%')
        .order('table_name')

      if (tableError) {
        throw new Error(`Error fetching tables: ${tableError.message}`)
      }

      const schemaData: TableSchema[] = []

      // Process each table
      for (const table of tableList || []) {
        const tableName = table.table_name as string
        
        // Get columns for this table
        const { data: columnsData, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select(`
            column_name,
            data_type,
            is_nullable,
            column_default
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position')

        if (columnsError) {
          throw new Error(`Error fetching columns for ${tableName}: ${columnsError.message}`)
        }

        // Get primary key columns
        const { data: pkData, error: pkError } = await supabase
          .from('information_schema.key_column_usage')
          .select(`
            column_name
          `)
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .eq('constraint_name', `${tableName}_pkey`)

        if (pkError) {
          console.warn(`Error fetching primary keys for ${tableName}: ${pkError.message}`)
        }

        // Get foreign key relationships - this might fail if the function doesn't exist
        let fkData: ForeignKeyInfo[] | null = null
        try {
          const { data, error: fkError } = await supabase
            .rpc('get_foreign_keys', { schema_name: 'public', table_name: tableName })

          if (!fkError) {
            fkData = data as ForeignKeyInfo[]
          }
        } catch (err) {
          console.warn(`Could not fetch foreign keys for ${tableName}: ${err}`)
        }

        // Process columns
        const columns = (columnsData as ColumnInfo[] || []).map(col => {
          const isPrimary = (pkData as PrimaryKeyInfo[] || []).some(pk => 
            pk.column_name === col.column_name
          ) || false
          
          // Find foreign key info for this column
          const foreignKey = fkData?.find(fk => fk.column_name === col.column_name)
          
          return {
            name: col.column_name,
            type: col.data_type,
            is_nullable: col.is_nullable === 'YES',
            is_primary: isPrimary,
            default_value: col.column_default,
            ...(foreignKey && {
              foreign_key: {
                table: foreignKey.foreign_table_name,
                column: foreignKey.foreign_column_name
              }
            })
          }
        })

        // Get row count
        let rowCount = 0
        try {
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true })

          if (!countError && count !== null) {
            rowCount = count
          }
        } catch (err) {
          console.warn(`Error counting rows for ${tableName}: ${err}`)
        }

        // Get sample data (first 5 rows)
        let sampleData: Record<string, any>[] = []
        try {
          const { data, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(5)

          if (!sampleError && data) {
            sampleData = data
          }
        } catch (err) {
          console.warn(`Error fetching sample data for ${tableName}: ${err}`)
        }

        schemaData.push({
          name: tableName,
          columns,
          row_count: rowCount,
          sample_data: sampleData
        })

        // Log the schema to the console for debugging/analysis
        console.log(`Table: ${tableName}`, {
          columns,
          rowCount,
          sampleData
        })
      }

      setTables(schemaData)
    } catch (error) {
      console.error('Schema inspection error:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  // Try to use the RPC version as backup if first method fails
  const inspectSchemaViaRPC = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Try using an RPC function if available
      const { data, error } = await supabase.rpc('get_schema_info')
      
      if (error) {
        if (error.message.includes('does not exist')) {
          setError("RPC function 'get_schema_info' doesn't exist. Try using the standard inspection method.")
        } else {
          setError(`RPC error: ${error.message}`)
        }
        return
      }
      
      if (Array.isArray(data)) {
        setTables(data as TableSchema[])
      }
    } catch (error) {
      console.error('Schema RPC inspection error:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  const renderColumnType = (column: TableSchema['columns'][0]) => {
    let color = 'bg-gray-100'
    
    if (column.is_primary) {
      color = 'bg-amber-100 text-amber-800'
    } else if (column.foreign_key) {
      color = 'bg-purple-100 text-purple-800'
    } else if (column.type.includes('int')) {
      color = 'bg-blue-100 text-blue-800'
    } else if (column.type.includes('char') || column.type.includes('text')) {
      color = 'bg-green-100 text-green-800'
    } else if (column.type.includes('date') || column.type.includes('time')) {
      color = 'bg-red-100 text-red-800'
    } else if (column.type.includes('bool')) {
      color = 'bg-yellow-100 text-yellow-800'
    }
    
    return (
      <Badge variant="outline" className={`${color} border-none font-mono text-xs`}>
        {column.type}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Database className="h-8 w-8" />
        Supabase Schema Inspector
      </h1>
      
      <div className="mb-6 flex gap-2">
        <Button onClick={inspectSchema} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Inspect Schema
        </Button>
        <Button variant="outline" onClick={inspectSchemaViaRPC} disabled={loading}>
          Try RPC Method
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error inspecting schema</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {tables.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Tables ({tables.length})</h2>
          
          <Accordion type="multiple" className="w-full">
            {tables.map((table) => (
              <AccordionItem value={table.name} key={table.name} className="border rounded-md my-2">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center text-left">
                    <Table className="h-5 w-5 mr-2" />
                    <span className="font-semibold">{table.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="ml-2">
                      {table.row_count} row{table.row_count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </AccordionTrigger>
                
                <AccordionContent className="border-t">
                  <Tabs defaultValue="structure">
                    <TabsList className="mb-2">
                      <TabsTrigger value="structure">Structure</TabsTrigger>
                      <TabsTrigger value="sample">Sample Data</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="structure">
                      <div className="p-2 overflow-auto">
                        <table className="min-w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nullable</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {table.columns.map((column) => (
                              <tr key={column.name} className={column.is_primary ? 'bg-amber-50' : ''}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                                  <div className="flex items-center">
                                    {column.is_primary && 
                                      <Badge variant="outline" className="mr-1 border-amber-500 bg-amber-50 text-amber-800">PK</Badge>
                                    }
                                    {column.name}
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  {renderColumnType(column)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  {column.is_nullable ? 'YES' : 'NO'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  {column.default_value || '-'}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  {column.foreign_key ? (
                                    <div className="flex items-center text-purple-700">
                                      <ArrowRight className="h-3 w-3 mr-1" />
                                      {column.foreign_key.table}.{column.foreign_key.column}
                                    </div>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="sample">
                      <div className="p-2 overflow-auto">
                        {table.sample_data && table.sample_data.length > 0 ? (
                          <table className="min-w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-50">
                                {table.columns.map(col => (
                                  <th key={col.name} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {table.sample_data.map((row, i) => (
                                <tr key={i}>
                                  {table.columns.map(col => (
                                    <td key={col.name} className="px-3 py-2 whitespace-nowrap text-sm">
                                      {row[col.name] === null 
                                        ? <span className="text-gray-400">NULL</span>
                                        : typeof row[col.name] === 'object'
                                          ? JSON.stringify(row[col.name])
                                          : String(row[col.name])
                                      }
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-gray-500 italic">No sample data available</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : !loading && (
        <div className="text-center py-8 text-gray-500">
          Click "Inspect Schema" to discover your database structure
        </div>
      )}
    </div>
  )
} 