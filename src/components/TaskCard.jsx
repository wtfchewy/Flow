import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

const priorityIcons = {
  low: <AlertCircle className="w-4 h-4 text-blue-500" />,
  medium: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  high: <AlertOctagon className="w-4 h-4 text-red-500" />,
};

const TaskCard = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`p-4 mb-3 rounded-lg shadow-sm bg-task 
            ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
            hover:shadow-md transition-all duration-200`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-white">{task.title}</h3>
            {priorityIcons[task.priority]}
          </div>
          <p className="text-sm text-gray-300">{task.description}</p>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;