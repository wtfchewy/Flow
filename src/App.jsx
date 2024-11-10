import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './components/Column';
import { ChevronLeft } from 'lucide-react';

const initialData = [
  {
    id: 'backlog',
    title: 'Backlog',
    tasks: [

    ],
  },
  {
    id: 'week',
    title: 'This Week',
    tasks: [

    ],
  },
  {
    id: 'today',
    title: 'Today',
    tasks: [

    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [

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

  const countTasks = columns.reduce((acc, column) => acc + column.tasks.length, 0);
  const estTime = columns.reduce((acc, column) => {
    column.tasks.forEach(task => {
      const [hours, minutes] = task.time.split(':');
      acc += parseInt(hours) * 60 + parseInt(minutes);
    });
    return acc;
  }
  , 0);

  return (
    <div className="flex flex-col justify-between min-h-screen bg-background px-8 pb-8 py-1">
      <div className='mb-4 w-full h-10 flex flex-row justify-between items-center'>
        <div className='flex flex-row items-center gap-4'>
          <button className='flex flex-row font-bold text-zinc-600 hover:text-zinc-500'>
            <ChevronLeft className='w-6 h-6' />
            BACK
          </button>

          <span className='font-light text-sm text-zinc-500'>This list has {countTasks} pending tasks, Est: {estTime}</span>
        </div>

        <div className='flex flex-row items-center bg-zinc-800 rounded-md px-7 py-1'>
          <h1 className='text-lg font-semibold text-white'>Flow</h1>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="w-full flex flex-grow gap-6 overflow-x-auto">
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