import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { XIcon, Plus, Clock, Edit2Icon } from 'lucide-react';

const TaskCard = ({ column, task, index, onDeleteTask, onEditTaskTime, onEditTaskTitle }) => {
  const [isHovering, setHover] = React.useState(false);
  const [isEditingTitle, setEditingTitle] = React.useState(false);
  const [isEditingTime, setEditingTime] = React.useState(false);

  const [title, setTitle] = React.useState(task.title);
  const [time, setTime] = React.useState(task.time);

  const handleEditTaskTime = () => {
    onEditTaskTime(column.id, task.id, time);
    setEditingTime(false);
  };

  const handleEditTaskTitle = () => {
    onEditTaskTitle(column.id, task.id, title);
    setEditingTitle(false);
  };

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
          className={`p-4 mb-3 rounded-lg shadow-sm hover:brightness-105 bg-border 
            ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
            hover:shadow-md transition-all duration-200`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className='flex items-center gap-2 overflow-hidden'>
              <span className='text-copy-lighter'>{index + 1}</span>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditTaskTitle();
                    if (e.key === 'Escape') handleEditTaskTitle();
                  }}
                  onBlur={() => setEditingTitle(false)}
                  className="text-sm w-32 px-2 py-1 bg-background rounded-lg focus:outline-none"
                  autoFocus
                />
              ) : (
                <h3 className="font-medium text-nowrap overflow-hidden text-ellipsis">{title}</h3>
              )}
            </div>
          </div>
          <div className='flex flex-row justify-between items-center'>
            {isEditingTime ? (
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditTaskTime();
                  if (e.key === 'Escape') handleEditTaskTime();
                }}
                onBlur={() => setEditingTime(false)}
                className="text-sm w-16 px-2 py-1 bg-background rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            ) : (
              <div onClick={() => setEditingTime(true)} className="flex items-center gap-1 text-copy-light cursor-pointer">
                {task.time === '00:00' ? (
                  <>
                    <Plus className="w-4 h-4" />
                    <p className="text-sm">EST</p>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <p className="text-sm">{convertTime(task.time)}</p>
                  </>
                )}
              </div>
            )}
            <div className={`flex flex-row items-center gap-2 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
              <button onClick={() => setEditingTitle(true)}>
                <Edit2Icon className="w-3 h-3 text-copy-light hover:text-primary duration-100" />
              </button>
              <button onClick={() => onDeleteTask(column.id, task.id)}>
                <XIcon className="w-4 h-4 text-copy-light hover:text-primary duration-100" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;