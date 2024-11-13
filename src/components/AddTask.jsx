import React, { useState } from 'react';
import { Plus, X} from 'lucide-react';

const AddTask = ({ onAddTask }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('00:00');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      time: time.trim(),
      timeTaken: '00:00',
    });

    setTitle('');
    setTime('00:00');
    setIsOpen(false);
  };

  return (
    <div className="mb-4">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-2 px-4 rounded-lg border-2 border-dashed border-white/20 
            text-white/20 hover:border-primary hover:text-primary 
            transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Task
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-task rounded-lg p-3 shadow-sm">
          <div className='flex flex-row items-center justify-between mb-2'>
            <h1 className='font-bold text-lg'>New Task</h1>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors duration-200"
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='flex flex-row gap-2'>
            <label className='flex flex-col gap-1'>
              <span className="text-xs text-white/70">Title</span>
              <input
                autoCorrect='off'
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                className="text-sm w-full mb-2 px-3 py-2 text-white bg-column rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </label>
            <label className='flex flex-col w-2/6 gap-1'>
              <span className="text-xs text-white/70">Est. Time</span>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-sm mb-2 px-3 py-2 text-white bg-column rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full mt-1 px-4 py-2 text-sm bg-primary font-semibold tracking-wide text-black rounded-lg 
              hover:bg-primary/80 transition-colors duration-200"
          >
            Add Task
          </button>
        </form>
      )}
    </div>
  );
};

export default AddTask;