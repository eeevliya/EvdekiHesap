'use client'

import { useState, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GridItem {
  id: string
  content: ReactNode
}

interface SortableCardProps {
  id: string
  children: ReactNode
}

function SortableCard({ id, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group break-inside-avoid mb-4',
        isDragging && 'opacity-50 z-50'
      )}
      {...attributes}
    >
      {/* Drag handle — visible on hover (desktop only) */}
      <div
        {...listeners}
        className="absolute -left-2 top-4 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab active:cursor-grabbing"
      >
        <div
          className="rounded-md p-1 shadow-md"
          style={{ background: 'var(--color-bg-card-hover)', border: '1px solid var(--color-border)' }}
        >
          <GripVertical className="size-4" style={{ color: 'var(--color-fg-secondary)' }} />
        </div>
      </div>
      {children}
    </div>
  )
}

interface DashboardGridProps {
  items: GridItem[]
}

/**
 * Desktop drag-and-drop grid using @dnd-kit.
 * Order resets on page reload (in-session only, no persistence).
 * On mobile, renders a plain stack (no drag handles).
 */
export function DashboardGrid({ items: initialItems }: DashboardGridProps) {
  const [items, setItems] = useState(initialItems)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // require 8px drag before activating
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id)
        const newIndex = prev.findIndex((i) => i.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  // Mobile: simple column stack, no DnD
  return (
    <>
      {/* Mobile layout */}
      <div className="flex md:hidden flex-col gap-4">
        {items.map((item) => (
          <div key={item.id}>{item.content}</div>
        ))}
      </div>

      {/* Desktop layout — masonry columns with DnD */}
      <div className="hidden md:block">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="columns-1 lg:columns-2 xl:columns-3 gap-5">
              {items.map((item) => (
                <SortableCard key={item.id} id={item.id}>
                  {item.content}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </>
  )
}
