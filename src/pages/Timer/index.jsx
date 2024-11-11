import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList } from '../../context/ListContext';
import { invoke } from '@tauri-apps/api/core';
import AddTask from '../../components/AddTask';
import { ChevronLeft, CircleCheck } from 'lucide-react';

const Timer = () => {
    const navigate = useNavigate();
    const { lists, setLists, currentList, setCurrentList } = useList();
    const todayTasks = currentList.columns.find(column => column.id === 'today').tasks;
    const doneTasks = currentList.columns.find(column => column.id === 'done').tasks;

    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [currentTask, setCurrentTask] = useState(todayTasks[0]);
    const [currentCountdown, setCurrentCountdown] = useState(todayTasks[0].time + ':00'); // Initialize with seconds

    const handleAddTask = (task) => {
        const newTask = {
          ...task,
          id: Math.random().toString(36).substr(2, 9), // Ensure unique id
        };
    
        const updatedLists = lists.map(list => {
          if (list === currentList) {
            return {
              ...list,
              columns: list.columns.map(column => {
                if (column.id === 'today') {
                  return {
                    ...column,
                    tasks: [...column.tasks, newTask],
                  };
                }
                return column;
              }),
            };
          }
          return list;
        });
    
        setLists(updatedLists);
        setCurrentList(updatedLists.find(list => list.title === currentList.title));
    };

    useEffect(() => {
        invoke('set_window_size', { size: 'small' });
    }, []);
    
    const handleBack = () => {
        navigate('/list');
        invoke('set_window_size', { size: 'normal' });
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentCountdown(prevCountdown => {
                const [hours, minutes, seconds] = prevCountdown.split(':').map(Number);
                if (seconds === 0) {
                    if (minutes === 0) {
                        if (hours === 0) {
                            clearInterval(timer);
                            handleNextTask();
                            return '00:00:00';
                        }
                        return `${String(hours - 1).padStart(2, '0')}:59:59`;
                    }
                    return `${String(hours).padStart(2, '0')}:${String(minutes - 1).padStart(2, '0')}:59`;
                }
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds - 1).padStart(2, '0')}`;
            });
        }, 1000); // Update every second

        return () => clearInterval(timer);
    }, [currentTask]);

    const handleNextTask = () => {
        const updatedLists = lists.map(list => {
            if (list === currentList) {
            return {
                ...list,
                columns: list.columns.map(column => {
                if (column.id === 'today') {
                    return {
                    ...column,
                    tasks: column.tasks.filter(task => task.id !== currentTask.id),
                    };
                }
                if (column.id === 'done') {
                    return {
                    ...column,
                    tasks: [...column.tasks, currentTask],
                    };
                }
                return column;
                }),
            };
            }
            return list;
        });

        setLists(updatedLists);
        setCurrentList(updatedLists.find(list => list.title === currentList.title));

        if (currentTaskIndex < todayTasks.length - 1) {
            const nextTaskIndex = currentTaskIndex + 1;
            setCurrentTaskIndex(nextTaskIndex);
            setCurrentTask(todayTasks[nextTaskIndex]);
            setCurrentCountdown(todayTasks[nextTaskIndex].time + ':00');
        } else {
            handleBack();
        }
    };

    const selectTask = (index) => {
        setCurrentTaskIndex(index);
        setCurrentTask(todayTasks[index]);
        setCurrentCountdown(todayTasks[index].time + ':00');
    }

    return (
        <div className="flex flex-col bg-background h-screen w-screen p-8">
            <div className="flex items-center justify-between mt-4">
                <h1 className='text-3xl font-bold'>Today</h1>
                <button onClick={() => handleBack()} className='flex flex-row font-bold text-zinc-600 hover:text-zinc-500'>
                    <ChevronLeft className='w-6 h-6' />
                    BACK
                </button>
            </div>

            <div className='flex flex-col flex-grow gap-3'>
                <div className='border border-secondary flex flex-row items-center justify-between bg-task rounded-lg p-4 mt-7'>
                    <h3 className='text-white font-medium'>{currentTask.title}</h3>
                    <p className='text-gray-300 font-bold text-lg'>{currentCountdown}</p>
                </div>

                {todayTasks.map((task, index) => (
                    index !== currentTaskIndex && (
                        <button onClick={() => selectTask(index)} key={task.id} className={`w-full flex flex-row justify-between bg-task hover:bg-zinc-700 rounded-lg p-4`}>
                            <h3 className='text-white font-medium'>{task.title}</h3>
                            {/* <p className='text-gray-300 text-sm'>{task.time}</p> */}
                        </button>
                    )
                ))}

                <AddTask onAddTask={(task) => handleAddTask(task)}/>
                
                {doneTasks.length > 0 && (
                    <>
                        <h1 className='text-zinc-700 font-semibold text-md w-full border-t border-zinc-700 pt-4 -mb-1'>{doneTasks.length} Done</h1>
                        {doneTasks.map((task, index) => (
                            <div key={task.id} className="bg-task rounded-lg p-3 flex items-center gap-2 -mb-1">
                                <CircleCheck className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-medium text-sm text-white line-through">{task.title}</h3>
                            </div>
                        ))}
                    </>
                )}
            </div>

            <button className='font-bold tracking-wider text-background rounded-lg py-2 w-full bg-gradient-to-r from-indigo-500 to-secondary hover:-translate-y-1 duration-100'>
                Focus
            </button>
        </div>
    );
};

export default Timer;