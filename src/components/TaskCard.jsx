import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { XIcon, Plus, Clock, Edit, Edit2Icon } from 'lucide-react';

const TaskCard = ({ column, task, index, onDeleteTask }) => {
  const [isHovering, setHover] = React.useState(false);

  const convertTime = (time) => {
    if (time === '00:00') return 'No time estimate';
    const [hours, minutes] = time.split(':');
    return `${parseInt(hours) > 0 ? `${hours}hr` : ''} ${parseInt(minutes) > 0 ? `${minutes}m` : ''}`;
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
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className='flex items-center gap-2 overflow-hidden'>
              <span className='text-zinc-600'>{index + 1}</span>
              <h3 className="font-medium text-white text-nowrap overflow-hidden text-ellipsis">{task.title}</h3>
            </div>
          </div>
          <div className='flex flex-row justify-between items-center'>
            {task.time === '00:00' ? (
              <button className="flex items-center gap-1 text-zinc-300">
                <Plus className="w-4 h-4" />
                <p className="text-sm">EST</p>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-zinc-300">
                <Clock className="w-4 h-4" />
                <p className="text-sm">{convertTime(task.time)}</p>
              </div>
            )}
            <div>

            </div>
            <div className={`flex flex-row items-center gap-2 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
              <button>
                <Edit2Icon className="w-3 h-3 text-zinc-300 hover:text-primary duration-100" />
              </button>
              <button onClick={() => onDeleteTask(column.id, task.id)}>
                <XIcon className="w-4 h-4 text-zinc-300 hover:text-primary duration-100" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;