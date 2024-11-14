import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { CircleCheck } from 'lucide-react';

const TaskCard = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id} index={index} className=''>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-3 mb-3 rounded-lg shadow-sm hover:brightness-105 bg-border 
            ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
            hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-center justify-between">
            <div className='flex items-center gap-2'>
                <CircleCheck className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-sm line-through">{task.title}</h3>
            </div>

            <span className='text-sm text-copy-light'>{task.timeTaken}</span>
          </div>

        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;