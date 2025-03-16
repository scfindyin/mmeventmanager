import { AgendaService } from '../agenda-service'
import { supabase } from '@/lib/supabase'
import type { AgendaItem } from '@/lib/types'

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}))

// Mock fetch
global.fetch = jest.fn()

describe('AgendaService', () => {
  let service: AgendaService
  
  beforeEach(() => {
    service = AgendaService.getInstance()
    jest.clearAllMocks()
  })

  const mockAgendaItem: AgendaItem = {
    id: '1',
    event_id: 'event1',
    topic: 'Test Topic',
    description: 'Test Description',
    durationMinutes: 60,
    dayIndex: 0,
    order: 10,
    startTime: '09:00',
    endTime: '10:00'
  }

  const mockApiResponse = {
    success: true,
    items: [mockAgendaItem],
    message: 'Operation successful'
  }

  describe('updateItem', () => {
    it('should successfully update an item', async () => {
      // Mock fetch response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.updateItem({
        item: {
          id: '1',
          event_id: 'event1',
          topic: 'Test Topic',
          description: 'Test Description',
          duration_minutes: 60,
          day_index: 0,
          order_position: 10,
          start_time: '09:00',
          end_time: '10:00'
        }
      })

      expect(result).toEqual(mockApiResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agenda-items/create',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
    })

    it('should handle API errors', async () => {
      const errorMessage = 'API Error'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage })
      })

      await expect(service.updateItem({
        item: {
          id: '1',
          event_id: 'event1',
          topic: 'Test Topic',
          description: '',
          duration_minutes: 60,
          day_index: 0,
          order_position: 10,
          start_time: '09:00',
          end_time: '10:00'
        }
      })).rejects.toThrow(errorMessage)
    })
  })

  describe('deleteItem', () => {
    it('should successfully delete an item', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.deleteItem('1')

      expect(result).toEqual(mockApiResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agenda-items/delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ 
            id: '1',
            triggerFullRecalculation: true 
          })
        })
      )
    })

    it('should handle delete errors', async () => {
      const errorMessage = 'Delete failed'
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage })
      })

      await expect(service.deleteItem('1')).rejects.toThrow(errorMessage)
    })
  })

  describe('moveItemToDay', () => {
    it('should move an item to a different day', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.moveItemToDay(mockAgendaItem, 1, 20)

      expect(result).toEqual(mockApiResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agenda-items/create',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"day_index":1')
        })
      )
    })
  })

  describe('reorderItems', () => {
    it('should reorder items and trigger recalculation', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.reorderItems(mockAgendaItem, [mockAgendaItem])

      expect(result).toEqual(mockApiResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agenda-items/create',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"triggerFullRecalculation":true')
        })
      )
    })
  })

  describe('getEventItems', () => {
    it('should fetch items for an event', async () => {
      const mockDbItems = [{
        id: '1',
        event_id: 'event1',
        topic: 'Test Topic',
        description: 'Test Description',
        duration_minutes: 60,
        day_index: 0,
        order_position: 10,
        start_time: '09:00',
        end_time: '10:00'
      }]

      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockDbItems,
                error: null
              })
            })
          })
        })
      })

      const result = await service.getEventItems('event1')

      expect(result).toEqual([mockAgendaItem])
      expect(supabase.from).toHaveBeenCalledWith('agenda_items')
    })

    it('should handle database errors', async () => {
      const errorMessage = 'Database error'
      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: new Error(errorMessage)
              })
            })
          })
        })
      })

      await expect(service.getEventItems('event1')).rejects.toThrow()
    })
  })

  describe('moveItemInDay', () => {
    it('should move an item within the same day', async () => {
      // Mock supabase update calls
      ;(supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      })

      // Mock API call for recalculation
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.moveItemInDay(
        mockAgendaItem,
        20,
        [mockAgendaItem]
      )

      expect(result).toEqual(mockApiResponse)
      expect(supabase.from).toHaveBeenCalledWith('agenda_items')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle database errors during move', async () => {
      ;(supabase.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ 
            error: new Error('Update failed') 
          })
        })
      })

      await expect(service.moveItemInDay(
        mockAgendaItem,
        20,
        [mockAgendaItem]
      )).rejects.toThrow('Failed to update item position')
    })
  })
}) 