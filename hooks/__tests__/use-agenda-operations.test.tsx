import { renderHook, act } from '@testing-library/react'
import { useAgendaOperations } from '../use-agenda-operations'
import { agendaService } from '@/lib/services/agenda-service'
import type { AgendaItem } from '@/lib/types'
import { v4 as uuidv4 } from 'uuid'

// Mock the dependencies
jest.mock('@/lib/services/agenda-service', () => ({
  agendaService: {
    deleteItem: jest.fn().mockResolvedValue({ items: [] }),
    splitItem: jest.fn().mockResolvedValue({ items: [] }),
    moveItemInDay: jest.fn().mockResolvedValue({ items: [] }),
    moveItemToDay: jest.fn().mockResolvedValue({ items: [] }),
    reorderItems: jest.fn().mockResolvedValue({ items: [] }),
  }
}))
jest.mock('uuid', () => ({
  v4: () => '3'
}))

const mockToast = jest.fn()
const mockOnReorder = jest.fn()

const mockItems: AgendaItem[] = [
  {
    id: '1',
    event_id: '1',
    topic: 'Topic 1',
    description: 'Description 1',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    dayIndex: 0,
    order: 0,
  },
  {
    id: '2',
    event_id: '1',
    topic: 'Topic 2',
    description: 'Description 2',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    dayIndex: 0,
    order: 1,
  },
]

describe('useAgendaOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete an item successfully', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    await act(async () => {
      await result.current.deleteItem(mockItems[0])
    })
    expect(agendaService.deleteItem).toHaveBeenCalledWith(mockItems[0].id)
  })

  it('should split an item successfully', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    await act(async () => {
      await result.current.splitItem(mockItems[0], 15)
    })
    expect(agendaService.splitItem).toHaveBeenCalledWith(mockItems[0], '3', 15)
  })

  it('should move an item up within the same day', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    const mockItemsWithOrder = [
      { ...mockItems[0], order: 10, dayIndex: 0 },
      { ...mockItems[1], order: 20, dayIndex: 0 }
    ]
    
    await act(async () => {
      await result.current.moveItemInDay(mockItemsWithOrder[1], 'up', mockItemsWithOrder)
    })
    
    expect(agendaService.moveItemInDay).toHaveBeenCalledWith(
      mockItemsWithOrder[1],
      10,
      expect.arrayContaining([
        expect.objectContaining({ id: mockItemsWithOrder[0].id, order: 20 }),
        expect.objectContaining({ id: mockItemsWithOrder[1].id })
      ])
    )
  })

  it('should move an item to the next day', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    const mockItemsWithOrder = [
      { ...mockItems[0], order: 10, dayIndex: 0 },
      { ...mockItems[1], order: 20, dayIndex: 0 }
    ]
    
    await act(async () => {
      await result.current.moveItemToDay(mockItemsWithOrder[1], 'next', mockItemsWithOrder, 2)
    })
    
    expect(agendaService.moveItemToDay).toHaveBeenCalledWith(
      mockItemsWithOrder[1],
      1,
      10
    )
  })

  it('should handle drag and drop reordering', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    const mockItemsWithOrder = [
      { ...mockItems[0], order: 10, dayIndex: 0 },
      { ...mockItems[1], order: 20, dayIndex: 0 }
    ]
    
    await act(async () => {
      await result.current.handleDragEnd({
        source: { index: 0, droppableId: 'day-0' },
        destination: { index: 1, droppableId: 'day-0' },
        draggableId: mockItemsWithOrder[0].id,
      }, mockItemsWithOrder)
    })

    expect(agendaService.reorderItems).toHaveBeenCalledWith(
      expect.objectContaining({ id: mockItemsWithOrder[0].id }),
      mockItemsWithOrder
    )
  })

  it('should handle errors when deleting an item', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    jest.spyOn(agendaService, 'deleteItem').mockRejectedValueOnce(new Error('Failed to delete'))
    await act(async () => {
      await expect(result.current.deleteItem(mockItems[0])).rejects.toThrow('Failed to delete')
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error deleting item',
      description: 'Failed to delete',
      variant: 'destructive',
    })
  })

  it('should handle errors when splitting an item', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    jest.spyOn(agendaService, 'splitItem').mockRejectedValueOnce(new Error('Failed to split'))
    await act(async () => {
      await expect(result.current.splitItem(mockItems[0], 15)).rejects.toThrow('Failed to split')
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error Splitting Item',
      description: 'Failed to split',
      variant: 'destructive',
    })
  })

  it('should handle errors when moving an item within the same day', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    const mockItemsWithOrder = [
      { ...mockItems[0], order: 10, dayIndex: 0 }
    ]
    
    await act(async () => {
      await expect(result.current.moveItemInDay(mockItemsWithOrder[0], 'up', mockItemsWithOrder)).rejects.toThrow('Invalid move operation')
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error moving item',
      description: 'Invalid move operation',
      variant: 'destructive',
    })
  })

  it('should handle errors when moving an item to another day', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    jest.spyOn(agendaService, 'moveItemToDay').mockRejectedValueOnce(new Error('Failed to move'))
    await act(async () => {
      await expect(result.current.moveItemToDay(mockItems[0], 'next', mockItems, 10)).rejects.toThrow('Failed to move')
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error moving item',
      description: 'Failed to move',
      variant: 'destructive',
    })
  })

  it('should handle errors when reordering items', async () => {
    const { result } = renderHook(() => useAgendaOperations({ onReorder: mockOnReorder, toast: mockToast }))
    
    jest.spyOn(agendaService, 'reorderItems').mockRejectedValueOnce(new Error('Failed to reorder'))
    await act(async () => {
      await expect(result.current.handleDragEnd({
        source: { index: 0, droppableId: 'day-0' },
        destination: { index: 1, droppableId: 'day-0' },
        draggableId: mockItems[0].id,
      }, mockItems)).rejects.toThrow('Failed to reorder')
    })
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error moving item',
      description: 'There was a problem moving the item. Try again or refresh the page.',
      variant: 'destructive',
    })
  })
}) 