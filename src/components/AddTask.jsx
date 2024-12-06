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
          className="font-semibold w-full py-2 border-b border-copy-lighter text-copy-lighter hover:border-copy-light hover:text-copy-light transition-colors duration-200 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Task
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="py-2 ">
          <div className='flex flex-row items-center justify-between mb-2'>
            <button
            onClick={() => setIsOpen(false)}
            className="w-full pb-2 border-b font-semibold border-copy-lighter text-copy-lighter hover:border-copy-light hover:text-copy-light transition-colors duration-200 flex items-center gap-2">
            <X className="w-5 h-5" />
            Cancel
            </button>
          </div>

          <div className='pt-2 flex flex-row gap-2'>
            <label className='flex flex-col gap-1'>
              <span className="text-xs text-copy-lighter">Title</span>
              <input
                autoCorrect='off'
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                placeholder="Enter task title"
                className="text-sm w-full mb-2 px-3 py-2 bg-background rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </label>
            <label className='flex flex-col w-3/12 gap-1'>
              <span className="text-xs text-copy-lighter">Est. Time</span>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-sm mb-2 px-3 py-2 bg-background rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full mt-1 px-4 py-2 text-sm text-primary-content bg-primary font-semibold tracking-wide rounded-lg 
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