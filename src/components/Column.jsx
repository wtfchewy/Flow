import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';

const Column = ({ column, onAddTask }) => {
  return (
    <div className="w-80 bg-column rounded-lg border border-zinc-700 p-4">
      <h2 className="text-lg font-semibold mb-4 text-white">{column.title}</h2>
      <AddTask onAddTask={(task) => onAddTask(column.id, task)} />
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[500px] transition-colors duration-200`}
          >
            {column.tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default Column;