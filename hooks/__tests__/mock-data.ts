import type { AgendaItem } from '@/lib/types'

export const mockItems: AgendaItem[] = [
  {
    id: '1',
    event_id: 'event1',
    topic: 'Topic 1',
    description: 'Description 1',
    startTime: '09:00',
    endTime: '09:30',
    durationMinutes: 30,
    dayIndex: 0,
    order: 10,
  },
  {
    id: '2',
    event_id: 'event1',
    topic: 'Topic 2',
    description: 'Description 2',
    startTime: '09:30',
    endTime: '10:15',
    durationMinutes: 45,
    dayIndex: 0,
    order: 20,
  },
]

export const mockReorderedItems: AgendaItem[] = [
  {
    ...mockItems[1],
    order: 10,
  },
  {
    ...mockItems[0],
    order: 20,
  },
] 