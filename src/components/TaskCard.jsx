import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { AlertCircle, AlertTriangle, AlertOctagon, XIcon } from 'lucide-react';

const TaskCard = ({ column, task, index, onDeleteTask }) => {

  const convertTime = (time) => {
    if (time == ('00:00')) return 'No time estimate';
    const [hours, minutes] = time.split(':');
    return `${parseInt(hours) > 0 ? `${hours}hr` : ''} ${parseInt(minutes) > 0 ? `${minutes}m` : ''
      }`;
  }
  return (
    <Draggable draggableId={task.id} index={index}>
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
  );
};

export default TaskCard;