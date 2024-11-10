import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList } from '../../context/ListContext';
import { invoke } from '@tauri-apps/api/core';

const Timer = () => {
    const navigate = useNavigate();
    const { currentList } = useList();
    const todayTasks = currentList.columns.find(column => column.id === 'today').tasks;
    
    const [currentCountdown, setCurrentCountdown] = useState(todayTasks[0].time + ':00'); // Initialize with seconds

    useEffect(() => {
        invoke('set_window_size', { size: 'small' });
    }, []);
    
    const handleBack = () => {
        navigate('/');
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
    }, []);

    return (
        <div className="flex flex-col bg-background h-screen w-screen p-8">
            <div className="flex items-center justify-between mt-4">
                <h1 className='text-3xl font-bold'>Today</h1>
                <button onClick={() => handleBack()} className='text-zinc-600 hover:text-zinc-500'>Back</button>
            </div>

            <div className='flex flex-col'>
                {todayTasks.map(task => (
                    <div key={task.id} className='flex flex-row justify-between bg-task rounded-lg p-4 mt-4'>
                        <h3 className='text-white font-medium'>{task.title}</h3>
                        <p className='text-gray-300 text-sm'>{currentCountdown}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Timer;