import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useList } from '../../context/ListContext';
import { invoke } from '@tauri-apps/api/core';
import AddTask from '../../components/AddTask';
import { ChevronLeft } from 'lucide-react';

const Timer = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { todayTasks } = location.state;

    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [currentTask, setCurrentTask] = useState(todayTasks[0]);
    const [currentCountdown, setCurrentCountdown] = useState(todayTasks[0].time + ':00'); // Initialize with seconds

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
        if (currentTaskIndex < todayTasks.length - 1) {
            const nextTaskIndex = currentTaskIndex + 1;
            setCurrentTaskIndex(nextTaskIndex);
            setCurrentTask(todayTasks[nextTaskIndex]);
            setCurrentCountdown(todayTasks[nextTaskIndex].time + ':00');
        } else {
            navigate('/');
            invoke('set_window_size', { size: 'normal' });
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

            <div className='flex flex-col gap-3'>
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

                <AddTask/>
            </div>
        </div>
    );
};

export default Timer;