import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import AddTask from './AddTask';
import DoneTaskCard from './DoneTaskCard';
import { useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';

const Column = ({ column, onAddTask, onDeleteTask, onEditTaskTime, onEditTaskTitle }) => {
  const navigate = useNavigate();

  const openTimer = () => {
    if (column.tasks.length === 0) {
      return;
    }
    navigate('/timer');
  };

  return (
    <div className={`w-1/4 bg-foreground rounded-lg border border-border p-4 flex flex-col  ${column.id == 'today' ? 'border-secondary' : ''} `}>
      <h2 className="text-lg font-semibold mb-4">{column.title} ({column.tasks.length})</h2>
      { column.id !== 'done' && <AddTask onAddTask={(task) => onAddTask(column.id, task)} /> }
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`overflow-y-auto transition-colors duration-200 flex-grow no-scrollbar`}
          >
            {column.tasks.length === 0 && (
              <div className="flex flex-col gap-3 flex-grow w-full h-full items-center justify-center text-copy-light font-medium">
                <CircleCheck className="w-10 h-10 text-primary" />
                All Tasks Completed
              </div>
            )}
            {column.tasks.map((task, index) => (
              column.id !== 'done' ? 
                <TaskCard key={task.id} column={column} task={task} index={index} onDeleteTask={onDeleteTask} onEditTaskTime={onEditTaskTime} onEditTaskTitle={onEditTaskTitle}/>
                :
                <DoneTaskCard key={task.id} task={task} index={index}/>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      { column.id === 'today' && <button onClick={() => openTimer()} className="mt-4 bg-gradient-to-r from-primary to-secondary text-foreground font-semibold py-2 rounded-lg hover:-translate-y-1 duration-100">Get into the Flow</button> }
    </div>
  );
};

export default Column;