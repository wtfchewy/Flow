import React, { useState } from 'react';
import { Plus, AlertCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

const AddTask = ({ onAddTask }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      description: description.trim(),
      priority,
    });

    setTitle('');
    setDescription('');
    setPriority('medium');
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
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full mb-2 px-3 py-2 text-gray-300 bg-zinc-900 rounded-md 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full mb-1 px-3 py-2 text-gray-300 bg-zinc-900 rounded-md 
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              resize-none h-20"
          />
          <div className="flex items-center gap-2 mb-3 rounded-md bg-zinc-900 px-3 py-1">
            <span className="text-sm text-white">Priority:</span>
            <div className="flex gap-2">
              {[
                { value: 'low', icon: AlertCircle, color: 'blue' },
                { value: 'medium', icon: AlertTriangle, color: 'yellow' },
                { value: 'high', icon: AlertOctagon, color: 'red' },
              ].map(({ value, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`p-2 rounded-md transition-colors duration-200 
                    ${priority === value 
                      ? `bg-indigo-500 text-white` 
                      : 'text-gray-400 hover:bg-zinc-800'}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-1/4 flex justify-center px-4 py-2 text-sm bg-red-500 rounded-md text-white hover:bg-red-600 
                transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-3/4 px-4 py-2 text-sm bg-indigo-500 text-white rounded-md 
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