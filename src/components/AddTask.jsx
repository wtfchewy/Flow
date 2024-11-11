import React, { useState } from 'react';
import { Plus} from 'lucide-react';

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
          className="w-full py-2 px-4 rounded-lg border-2 border-dashed border-gray-300 
            text-gray-300 hover:border-indigo-500 hover:text-indigo-500 
            transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Task
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-task rounded-lg p-3 shadow-sm">
          <div className='flex flex-row gap-2'>
            <label className='flex flex-col gap-1'>
              <span className="text-xs text-zinc-500">Title</span>
              <input
                autoCorrect='off'
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                className="text-sm w-full mb-2 px-3 py-2 text-gray-300 bg-zinc-900 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </label>
            <label className='flex flex-col w-2/6 gap-1'>
              <span className="text-xs text-zinc-500">Est. Time</span>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-sm mb-2 px-3 py-2 text-gray-300 bg-zinc-900 rounded-lg 
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-1/4 flex justify-center px-4 py-2 text-sm bg-red-500 rounded-lg text-white hover:bg-red-600 
                transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-3/4 px-4 py-2 text-sm bg-indigo-500 text-white rounded-lg 
                hover:bg-indigo-600 transition-colors duration-200"
            >
              Add Task
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddTask;