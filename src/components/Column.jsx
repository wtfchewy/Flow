import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';
import { useNavigate } from 'react-router-dom';

const Column = ({ column, onAddTask, onDeleteTask }) => {
  const navigate = useNavigate();

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
              
            <TaskCard key={task.id} column={column} task={task} index={index} onDeleteTask={onDeleteTask} />

            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      { column.id === 'today' && <button onClick={() => navigate('/timer')} className="mt-4 bg-gradient-to-r from-indigo-500 to-secondary text-background font-semibold py-2 rounded-lg hover:-translate-y-1 duration-100">Get into the Flow</button> }
    </div>
  );
};

export default Column;