import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from '@testing-library/react'
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { AgendaItemList } from '../agenda-item-list'
import { agendaService } from '@/lib/services/agenda-service'
import type { AgendaItem } from '@/lib/types'
import type { ReactNode } from 'react'

// Mock the dependencies
jest.mock('@/lib/services/agenda-service')
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn()
  })
}))
jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: jest.fn(({ onDragEnd, children }) => children),
  Droppable: jest.fn(({ children }) => children({
    draggableProps: {},
    innerRef: jest.fn(),
  }, {
    isDraggingOver: false,
    draggingOverWith: null,
    draggingFromThisWith: null,
    isUsingPlaceholder: false
  })),
  Draggable: jest.fn(({ children }) => children({
    draggableProps: {},
    innerRef: jest.fn(),
    dragHandleProps: {}
  }, {
    isDragging: false,
    isDropAnimating: false,
    draggingOver: null,
    combineWith: null,
    combineTargetFor: null,
    mode: null
  }))
}))

// Mock data
const mockItems: AgendaItem[] = [
  {
    id: '1',
    event_id: 'event1',
    topic: 'Morning Session',
    description: 'Kickoff meeting',
    durationMinutes: 60,
    dayIndex: 0,
    order: 10,
    startTime: '09:00',
    endTime: '10:00'
  },
  {
    id: '2',
    event_id: 'event1',
    topic: 'Afternoon Session',
    description: 'Planning session',
    durationMinutes: 120,
    dayIndex: 0,
    order: 20,
    startTime: '13:00',
    endTime: '15:00'
  },
  {
    id: '3',
    event_id: 'event1',
    topic: 'Next Day Session',
    description: 'Follow-up',
    durationMinutes: 60,
    dayIndex: 1,
    order: 10,
    startTime: '09:00',
    endTime: '10:00'
  }
]

describe('AgendaItemList', () => {
  const defaultProps = {
    items: mockItems,
    isLoading: false,
    onEdit: jest.fn(),
    onReorder: jest.fn(),
    eventEndTime: '17:00',
    eventStartTime: '09:00'
  }

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock the initializeItemTimes method
    ;(agendaService.initializeItemTimes as jest.Mock).mockResolvedValue(mockItems)
  })

  afterAll(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('renders loading state correctly', () => {
    render(<AgendaItemList {...defaultProps} isLoading={true} />)
    
    // Each skeleton card has 3 parts
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(9)
  })

  it('renders empty state when no items', () => {
    render(<AgendaItemList {...defaultProps} items={[]} />)
    
    expect(screen.getByText('No agenda items yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first agenda item to get started.')).toBeInTheDocument()
  })

  it('renders items grouped by day', async () => {
    await act(async () => {
      render(<AgendaItemList {...defaultProps} />)
    })
    
    // Check day headers
    expect(screen.getByText('Day 1')).toBeInTheDocument()
    expect(screen.getByText('Day 2')).toBeInTheDocument()
    
    // Check items are rendered
    expect(screen.getByText('Morning Session')).toBeInTheDocument()
    expect(screen.getByText('Afternoon Session')).toBeInTheDocument()
    expect(screen.getByText('Next Day Session')).toBeInTheDocument()
    
    // Check durations are formatted correctly
    const oneHourElements = screen.getAllByText('1 hour')
    expect(oneHourElements).toHaveLength(2)
    expect(screen.getByText('2 hours')).toBeInTheDocument()
  })

  it('shows time exceeded warning when item exceeds event end time', async () => {
    const itemExceedingTime: AgendaItem = {
      ...mockItems[0],
      startTime: '16:00',
      endTime: '18:00' // Exceeds eventEndTime of 17:00
    }
    
    await act(async () => {
      render(<AgendaItemList {...defaultProps} items={[itemExceedingTime]} />)
    })
    
    expect(screen.getByText('Exceeds time limit')).toBeInTheDocument()
  })

  it('formats time correctly in 12-hour format', async () => {
    await act(async () => {
      render(<AgendaItemList {...defaultProps} />)
    })
    
    // Check time formatting
    const morningTimeElements = screen.getAllByText(/9:00am - 10:00am/)
    expect(morningTimeElements).toHaveLength(2)
    expect(screen.getByText(/1:00pm - 3:00pm/)).toBeInTheDocument()
  })

  it('initializes item times on mount', async () => {
    await act(async () => {
      render(<AgendaItemList {...defaultProps} />)
    })
    
    expect(agendaService.initializeItemTimes).toHaveBeenCalledWith(mockItems)
  })

  describe('item operations', () => {
    it('handles item deletion', async () => {
      const updatedItems = mockItems.slice(1) // All items except the first one
      ;(agendaService.deleteItem as jest.Mock).mockResolvedValueOnce({ items: updatedItems })
      
      await act(async () => {
        render(<AgendaItemList {...defaultProps} />)
      })
      
      // Find and click delete button for first item
      const deleteButtons = screen.getAllByTitle('Delete item')
      await act(async () => {
        fireEvent.click(deleteButtons[0])
      })
      
      expect(agendaService.deleteItem).toHaveBeenCalledWith(mockItems[0].id)
    })

    it('handles item splitting', async () => {
      const splitItems = [
        ...mockItems,
        {
          ...mockItems[0],
          id: 'new-split-id',
          topic: 'Morning Session (Split)',
          durationMinutes: 30,
          order: 15
        }
      ]
      ;(agendaService.splitItem as jest.Mock).mockResolvedValueOnce({ items: splitItems })
      
      await act(async () => {
        render(<AgendaItemList {...defaultProps} />)
      })
      
      // Find and click split button for first item
      const splitButtons = screen.getAllByTitle('Split this item into two')
      await act(async () => {
        fireEvent.click(splitButtons[0])
      })
      
      expect(agendaService.splitItem).toHaveBeenCalledWith(
        mockItems[0],
        expect.any(String), // new UUID
        expect.any(Number)  // new order
      )
    })

    it('handles moving item up within day', async () => {
      const reorderedItems = mockItems.map((item, index) => ({
        ...item,
        order: index === 0 ? 20 : 10
      }))
      ;(agendaService.moveItemInDay as jest.Mock).mockResolvedValueOnce({ items: reorderedItems })
      
      await act(async () => {
        render(<AgendaItemList {...defaultProps} />)
      })
      
      // Find and click move up button for second item
      const moveUpButtons = screen.getAllByTitle('Move up one item')
      await act(async () => {
        fireEvent.click(moveUpButtons[1]) // Second item's up button
      })
      
      expect(agendaService.moveItemInDay).toHaveBeenCalledWith(
        mockItems[1],
        10,
        expect.arrayContaining([
          expect.objectContaining({ id: mockItems[0].id, order: 20 }),
          expect.objectContaining({ id: mockItems[1].id })
        ])
      )
    })

    it('handles moving item to next day', async () => {
      const movedItems = mockItems.map(item => 
        item.id === '2' ? { ...item, dayIndex: 1 } : item
      )
      ;(agendaService.moveItemToDay as jest.Mock).mockResolvedValueOnce({ items: movedItems })
      
      await act(async () => {
        render(<AgendaItemList {...defaultProps} totalDays={2} />)
      })
      
      // Find and click move to next day button for second item
      const moveNextDayButtons = screen.getAllByTitle('Move to next day')
      await act(async () => {
        fireEvent.click(moveNextDayButtons[1]) // Second item's button
      })
      
      expect(agendaService.moveItemToDay).toHaveBeenCalledWith(
        mockItems[1], // Use the second item
        1, // target day index
        expect.any(Number) // new order
      )
    })

    it('handles drag and drop between days', async () => {
      const dragResult = {
        draggableId: mockItems[0].id,
        source: { droppableId: 'day-0', index: 0 },
        destination: { droppableId: 'day-1', index: 0 }
      }
      
      const reorderedItems = mockItems.map(item =>
        item.id === mockItems[0].id ? { ...item, dayIndex: 1, order: 5 } : item
      )
      ;(agendaService.reorderItems as jest.Mock).mockResolvedValueOnce({ items: reorderedItems })
      
      let onDragEndCallback: Function | null = null;
      (DragDropContext as jest.Mock).mockImplementation(({ onDragEnd, children }) => {
        onDragEndCallback = onDragEnd;
        return children;
      });
      
      render(<AgendaItemList {...defaultProps} />)
      
      // Wait for component to mount and callback to be captured
      await waitFor(() => {
        expect(onDragEndCallback).toBeDefined()
      })
      
      await act(async () => {
        await onDragEndCallback!(dragResult)
      })
      
      await waitFor(() => {
        expect(agendaService.reorderItems).toHaveBeenCalledWith(
          expect.objectContaining({ id: mockItems[0].id }),
          expect.any(Array)
        )
      })
    })
  })

  describe('error handling', () => {
    it('shows error dialog when operation fails', async () => {
      const error = new Error('Failed to delete item')
      ;(agendaService.deleteItem as jest.Mock).mockRejectedValueOnce(error)
      
      render(<AgendaItemList {...defaultProps} />)
      
      // Try to delete an item
      const deleteButtons = screen.getAllByTitle('Delete item')
      fireEvent.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText('Agenda Item Error')).toBeInTheDocument()
        expect(screen.getByText('Failed to delete item')).toBeInTheDocument()
      })
    })
  })

  describe('time restrictions', () => {
    it('disables time restrictions when adhereToTimeRestrictions is false', () => {
      const itemExceedingTime = {
        ...mockItems[0],
        startTime: '16:00',
        endTime: '18:00'
      }
      
      render(
        <AgendaItemList 
          {...defaultProps} 
          items={[itemExceedingTime]} 
          adhereToTimeRestrictions={false} 
        />
      )
      
      expect(screen.queryByText('Exceeds time limit')).not.toBeInTheDocument()
    })
  })
}) 