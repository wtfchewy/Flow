import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './components/Column';

const initialData = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      {
        id: '1',
        title: 'Research competitors',
        description: 'Analyze main competitors and their features',
        priority: 'high',
      },
      {
        id: '2',
        title: 'Design system',
        description: 'Create a consistent design system for the app',
        priority: 'medium',
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    tasks: [
      {
        id: '3',
        title: 'User authentication',
        description: 'Implement OAuth and email authentication',
        priority: 'high',
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [
      {
        id: '4',
        title: 'Project setup',
        description: 'Initialize repository and setup basic configuration',
        priority: 'low',
      },
    ],
  },
];

function App() {
  const [columns, setColumns] = useState(initialData);

  const handleAddTask = (columnId, task) => {
    const newTask = {
      ...task,
      id: Math.random().toString(36).substr(2, 9),
    };

    setColumns(columns.map(column => {
      if (column.id === columnId) {
        return {
          ...column,
          tasks: [...column.tasks, newTask],
        };
      }
      return column;
    }));
  };

  const handleDeleteTask = (columnId, taskId) => {
    setColumns(columns.map(column => {
      if (column.id === columnId) {
        return {
          ...column,
          tasks: column.tasks.filter(task => task.id !== taskId),
        };
      }
      return column;
    }));

    console.log('Task deleted:', taskId);
  };

  const onDragEnd = (result) => {
    const { destination, source } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumnIndex = columns.findIndex(column => column.id === source.droppableId);
    const destColumnIndex = columns.findIndex(column => column.id === destination.droppableId);

    const sourceColumn = columns[sourceColumnIndex];
    const destColumn = columns[destColumnIndex];

    const sourceTasks = Array.from(sourceColumn.tasks);
    const destTasks = Array.from(destColumn.tasks);

    const [movedTask] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, movedTask);

    const newColumns = Array.from(columns);
    newColumns[sourceColumnIndex] = {
      ...sourceColumn,
      tasks: sourceTasks,
    };
    newColumns[destColumnIndex] = {
      ...destColumn,
      tasks: destTasks,
    };

    setColumns(newColumns);
  };

  return (
    <div className="flex justify-between min-h-screen bg-background from-gray-100 to-gray-200 p-8">
      <div className="flex flex-col mb-8 items-start">
        <h1 className="text-3xl font-bold text-white">Test Board</h1>
        <h1 className='text-indigo-500 font-black text-2xl'>00:00:00</h1>

        <button className='mt-2 text-zinc-500 font-semibold'>Back</button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {columns.map((column) => (
            <Column 
              key={column.id} 
              column={column} 
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default App;