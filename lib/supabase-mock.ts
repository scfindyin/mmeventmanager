import type { PostgrestError } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Local storage key for mock data
const MOCK_STORAGE_KEY = 'event-agenda-manager-mock-data';

// Default mock data
const DEFAULT_MOCK_DATA = {
  events: [],
  agenda_items: [],
  sub_items: [],
  attendees: [],
};

// Load mock data from localStorage
const loadMockData = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_MOCK_DATA;
  }
  
  try {
    const storedData = localStorage.getItem(MOCK_STORAGE_KEY);
    return storedData ? JSON.parse(storedData) : DEFAULT_MOCK_DATA;
  } catch (error) {
    console.error('Error loading mock data:', error);
    return DEFAULT_MOCK_DATA;
  }
};

// Save mock data to localStorage
const saveMockData = (data: any) => {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving mock data:', error);
  }
};

// For date handling demo, we don't need a full Supabase implementation
// This is a minimal mock just to make the app work
class MockSupabaseClient {
  private mockData: any;

  constructor() {
    this.mockData = loadMockData();
    console.log('Mock Supabase client initialized');
  }

  // Create a select query builder
  from(table: string) {
    return {
      select: (columns = '*') => {
        return {
          eq: (column: string, value: any) => {
            return {
              single: () => {
                const data = this.mockData[table]?.find((item: any) => item[column] === value) || null;
                return Promise.resolve({ data, error: null });
              },
              order: () => {
                return {
                  data: this.mockData[table]?.filter((item: any) => item[column] === value) || [],
                  error: null
                };
              }
            };
          },
          order: () => {
            return {
              data: this.mockData[table] || [],
              error: null
            };
          }
        };
      },
      insert: (data: any) => {
        const newItem = {
          id: data.id || uuidv4(),
          created_at: new Date().toISOString(),
          ...data
        };
        
        this.mockData[table] = this.mockData[table] || [];
        this.mockData[table].push(newItem);
        saveMockData(this.mockData);
        
        return Promise.resolve({ data: newItem, error: null });
      },
      update: (data: any) => {
        return {
          eq: (column: string, value: any) => {
            const index = this.mockData[table]?.findIndex((item: any) => item[column] === value);
            if (index !== -1 && index !== undefined) {
              this.mockData[table][index] = {
                ...this.mockData[table][index],
                ...data,
              };
              saveMockData(this.mockData);
              return Promise.resolve({ data: this.mockData[table][index], error: null });
            }
            return Promise.resolve({ 
              data: null, 
              error: { message: 'Item not found' } as PostgrestError 
            });
          }
        };
      },
      delete: () => {
        return {
          eq: (column: string, value: any) => {
            const index = this.mockData[table]?.findIndex((item: any) => item[column] === value);
            if (index !== -1 && index !== undefined) {
              const deleted = this.mockData[table].splice(index, 1);
              saveMockData(this.mockData);
              return Promise.resolve({ data: deleted[0], error: null });
            }
            return Promise.resolve({ 
              data: null, 
              error: { message: 'Item not found' } as PostgrestError 
            });
          }
        };
      }
    };
  }

  // Mock storage API
  storage = {
    listBuckets: () => {
      return Promise.resolve({ 
        data: [{ name: 'event-assets', id: 'event-assets', public: true }], 
        error: null 
      });
    },
    createBucket: () => {
      return Promise.resolve({ 
        data: { name: 'event-assets', id: 'event-assets', public: true }, 
        error: null 
      });
    },
    from: (bucket: string) => {
      return {
        list: () => {
          return Promise.resolve({ 
            data: [], 
            error: null 
          });
        },
        getPublicUrl: (path: string) => {
          return {
            data: {
              publicUrl: `https://mock-storage.example.com/${bucket}/${path}`
            }
          };
        }
      };
    }
  };
}

// Export the mock client
export const createSupabaseMockClient = () => {
  return new MockSupabaseClient();
}; 