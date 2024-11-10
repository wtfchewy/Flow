import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';
import { XIcon } from 'lucide-react';

const Column = ({ column, onAddTask, onDeleteTask }) => {
  const convertTime = (time) => {
    if (time == ('00:00')) return 'No time estimate';
    const [hours, minutes] = time.split(':');
    return `${parseInt(hours) > 0 ? `${hours}hr` : ''} ${parseInt(minutes) > 0 ? `${minutes}m` : ''
      }`;
  }

  return (
    <div className={`w-1/4 bg-column rounded-lg border border-zinc-700 p-4 flex flex-col  ${column.id == 'today' ? 'border-secondary' : ''} `}>
      <h2 className="text-lg font-semibold mb-4 text-white">{column.title} ({column.tasks.length})</h2>
      <AddTask onAddTask={(task) => onAddTask(column.id, task)} />
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`transition-colors duration-200 flex-grow`}
          >
            {column.tasks.map((task, index) => (
              
            <Draggable key={task.id} draggableId={task.id} index={index}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className={`p-4 mb-3 rounded-lg shadow-sm hover:bg-zinc-700 bg-task 
                    ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
                    hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className='flex items-center gap-2'>
                      <span className='text-zinc-600'>{index + 1}</span>
                      <h3 className="font-medium text-white">{task.title}</h3>
                    </div>
                    <button onClick={() => onDeleteTask(column.id, task.id)}>
                      <XIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-300">{convertTime(task.time)}</p>
                </div>
              )}
            </Draggable>

            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      { column.id === 'today' && <button className="mt-4 bg-gradient-to-r from-indigo-500 to-secondary text-background font-semibold py-2 rounded-lg hover:-translate-y-1 duration-100">Get into the Flow</button> }
    </div>
  );
};

export default Column;