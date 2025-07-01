
"use client";

import React, { useState, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProjectForAdminList } from '@/app/actions/admin/fetchProjectsForAdmin';
import type { ProjectStatus } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { updateProjectByAdmin } from '@/app/actions/admin/updateProject';
import { useAuth } from '@/context/auth-context';
import { format, isPast, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface ProjectKanbanBoardProps {
  projects: ProjectForAdminList[];
  onProjectUpdate: () => void;
}

const KANBAN_COLUMNS: ProjectStatus[] = ['active', 'paused', 'completed', 'inactive'];

type Items = Record<ProjectStatus, ProjectForAdminList[]>;

export function ProjectKanbanBoard({ projects, onProjectUpdate }: ProjectKanbanBoardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Items>(() => {
    const initialItems: Items = { active: [], paused: [], completed: [], inactive: [] };
    projects.forEach(p => {
      const status = p.status || 'inactive';
      if(initialItems[status]) {
        initialItems[status].push(p);
      }
    });
    return initialItems;
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const newItems: Items = { active: [], paused: [], completed: [], inactive: [] };
    projects.forEach(p => {
      const status = p.status || 'inactive';
      if(newItems[status]) {
        newItems[status].push(p);
      }
    });
    setItems(newItems);
  }, [projects]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeContainer = active.data.current?.sortable.containerId as ProjectStatus;
    const overContainer = over.data.current?.sortable.containerId as ProjectStatus;
    const overId = over.id as string;

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    
    setItems(prev => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex(item => item.id === active.id);
      const overIndex = overItems.findIndex(item => item.id === overId);
      
      const newActiveItems = activeItems.filter(item => item.id !== active.id);
      const newOverItems = [...overItems];
      const [draggedItem] = activeItems.splice(activeIndex, 1);
      newOverItems.splice(overIndex, 0, draggedItem);
      
      return {
        ...prev,
        [activeContainer]: newActiveItems,
        [overContainer]: newOverItems,
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldStatus = active.data.current?.sortable.containerId as ProjectStatus;
    const newStatus = over.data.current?.sortable.containerId as ProjectStatus;
    
    // Optimistic update of the UI
    const projectToUpdate = findProject(active.id as string);
    if (!projectToUpdate) return;
    
    const newItems = { ...items };
    const oldColumn = Array.isArray(newItems[oldStatus]) ? [...newItems[oldStatus]] : [];
    const newColumn = (oldStatus === newStatus) ? oldColumn : (Array.isArray(newItems[newStatus]) ? [...newItems[newStatus]] : []);
    
    const oldIndex = oldColumn.findIndex(p => p.id === active.id);
    const [movedItem] = oldColumn.splice(oldIndex, 1);
    movedItem.status = newStatus;
    
    const newIndex = over.id === newStatus ? newColumn.length : newColumn.findIndex(p => p.id === over.id);
    newColumn.splice(newIndex, 0, movedItem);

    setItems({
      ...newItems,
      [oldStatus]: oldColumn,
      [newStatus]: newColumn
    });

    // Update status and order on the backend
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to update projects.', variant: 'destructive' });
      onProjectUpdate(); // Revert optimistic update
      return;
    }

    try {
      // Update the moved item's status
      const updateResult = await updateProjectByAdmin(user.id, active.id as string, { status: newStatus });
      if (!updateResult.success) {
        throw new Error(updateResult.message);
      }

      // Batch update the order of all items in the new column
      const updatePromises = newColumn.map((project, index) => 
        updateProjectByAdmin(user.id, project.id, { statusOrder: index })
      );
      // If moved from a different column, update the old column's order as well
      if (oldStatus !== newStatus) {
        oldColumn.forEach((project, index) => 
          updatePromises.push(updateProjectByAdmin(user.id, project.id, { statusOrder: index }))
        );
      }
      await Promise.all(updatePromises);
      toast({ title: 'Success', description: `Project "${movedItem.name}" moved to ${newStatus}.`, variant: 'default' });
      onProjectUpdate(); // Refresh data from server to ensure consistency
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
      onProjectUpdate(); // Revert optimistic update on failure
    }
  };

  const findProject = (id: string): ProjectForAdminList | undefined => {
    for (const status of KANBAN_COLUMNS) {
      const project = items[status]?.find(p => p.id === id);
      if (project) return project;
    }
    return undefined;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {KANBAN_COLUMNS.map(status => (
          <KanbanColumn key={status} id={status} title={status} projects={items[status] || []}>
            {items[status]?.map(project => (
              <KanbanCard key={project.id} project={project} />
            ))}
          </KanbanColumn>
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ id, title, children, projects }: { id: ProjectStatus, title: string, children: React.ReactNode, projects: ProjectForAdminList[] }) {
  const { setNodeRef } = useSortable({ id, data: { type: 'container' } });
  
  return (
    <SortableContext id={id} items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="bg-muted/50 rounded-lg p-3 flex flex-col gap-3 min-h-[200px]">
        <h3 className="font-semibold text-lg capitalize">{title} <Badge variant="secondary">{projects.length}</Badge></h3>
        {children}
      </div>
    </SortableContext>
  );
}

function KanbanCard({ project }: { project: ProjectForAdminList }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="hover:shadow-md cursor-grab active:cursor-grabbing">
        <CardHeader>
          <CardTitle className="text-base">{project.name}</CardTitle>
          <CardDescription className="text-xs line-clamp-2">{project.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            {project.dueDate && (
              <div className={cn("flex items-center", isPast(new Date(project.dueDate)) && "text-destructive font-semibold")}>
                <Clock className="mr-1 h-3 w-3" />
                {isValid(new Date(project.dueDate)) ? format(new Date(project.dueDate), 'MMM d') : 'N/A'}
              </div>
            )}
            {project.clientInfo && (
                <span className="truncate">{project.clientInfo}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
