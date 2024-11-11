import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';
import DoneTaskCard from './DoneTaskCard';
import { useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';

const Column = ({ column, onAddTask, onDeleteTask }) => {
  const navigate = useNavigate();

  const openTimer = () => {
    navigate('/timer');
  };

  return (
    <div className={`w-1/4 bg-column rounded-lg border border-zinc-800 p-4 flex flex-col  ${column.id == 'today' ? 'border-secondary' : ''} `}>
      <h2 className="text-lg font-semibold mb-4 text-white">{column.title} ({column.tasks.length})</h2>
      { column.id !== 'done' && <AddTask onAddTask={(task) => onAddTask(column.id, task)} /> }
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`overflow-hidden transition-colors duration-200 flex-grow`}
          >
            {column.tasks.length === 0 && (
              <div className="flex flex-col gap-3 flex-grow w-full h-full items-center justify-center text-zinc-500 font-medium">
                <CircleCheck className="w-10 h-10 text-primary" />
                All Tasks Completed
              </div>
            )}
            {column.tasks.map((task, index) => (
              column.id !== 'done' ? 
                <TaskCard key={task.id} column={column} task={task} index={index} onDeleteTask={onDeleteTask} />
                :
                <DoneTaskCard key={task.id} column={column} task={task} index={index} onDeleteTask={onDeleteTask} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      { column.id === 'today' && <button onClick={() => openTimer()} className="mt-4 bg-gradient-to-r from-primary to-secondary text-background font-semibold py-2 rounded-lg hover:-translate-y-1 duration-100">Get into the Flow</button> }
    </div>
  );
};

export default Column;