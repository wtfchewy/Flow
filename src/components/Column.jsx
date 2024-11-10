import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';

const Column = ({ column, onAddTask, onDeleteTask }) => {
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
    </div>
  );
};

export default Column;