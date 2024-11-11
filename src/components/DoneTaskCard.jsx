import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { AlertCircle, AlertTriangle, AlertOctagon, XIcon, Clock, Plus, CircleCheck } from 'lucide-react';

const TaskCard = ({ column, task, index, onDeleteTask }) => {
  const convertTime = (time) => {
    if (time == ('00:00')) return 'No time estimate';
    const [hours, minutes] = time.split(':');
    return `${parseInt(hours) > 0 ? `${hours}hr` : ''} ${parseInt(minutes) > 0 ? `${minutes}m` : ''
      }`;
  }

  return (
    <Draggable draggableId={task.id} index={index} className=''>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 mb-3 rounded-lg shadow-sm hover:bg-zinc-700 bg-task 
            ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
            hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-center justify-between">
            <div className='flex items-center gap-2'>
                <CircleCheck className="w-4 h-4 text-indigo-500" />
                <h3 className="font-medium text-sm text-white line-through">{task.title}</h3>
            </div>

            <span className='text-sm text-zinc-400'>{task.time}</span>
          </div>

        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;