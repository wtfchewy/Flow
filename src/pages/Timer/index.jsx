import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList } from '../../context/ListContext';
import { invoke } from '@tauri-apps/api/core';
import AddTask from '../../components/AddTask';
import { ChevronLeft, CircleCheck, Expand, PauseCircle, PlayCircle } from 'lucide-react';

const Timer = () => {
    const navigate = useNavigate();
    const [focused, setFocused] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isOvertime, setIsOvertime] = useState(false);

    const { lists, setLists, currentList, setCurrentList } = useList();
    const todayTasks = currentList.columns.find(column => column.id === 'today').tasks;
    const doneTasks = currentList.columns.find(column => column.id === 'done').tasks;

    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
    const [currentTask, setCurrentTask] = useState(todayTasks[0]);
    const [currentCountdown, setCurrentCountdown] = useState(todayTasks[0].time + ':00');
    const [timeTaken, setTimeTaken] = useState(todayTasks[0].timeTaken + ':00');

    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleAddTask = (task) => {
        const newTask = {
          ...task,
          id: Math.random().toString(36).substr(2, 9),
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

    const handleBack = () => {
        navigate('/list');
        invoke('set_window_size', { size: 'normal' });
    }

    useEffect(() => {
        if (focused) { return; }
        invoke('set_window_size', { size: 'small' });
    }, []);
    
    useEffect(() => {
        let timer;
        if (!isPaused) {
            timer = setInterval(() => {
                if (todayTasks[0].time !== '00:00') {
                    const [hours, minutes, seconds] = currentCountdown.split(':').map(Number);
                    if (hours === 0 && minutes === 0 && seconds === 0) {
                        clearInterval(timer);
                        // handleNextTask();
                        setIsOvertime(true);
                    } else {
                        const newSeconds = seconds === 0 ? 59 : seconds - 1;
                        const newMinutes = seconds === 0 ? (minutes === 0 ? 59 : minutes - 1) : minutes;
                        const newHours = seconds === 0 && minutes === 0 ? hours - 1 : hours;
                        setCurrentCountdown(`${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
                        setTimeTaken(prev => formatTime(parseInt(prev.split(':').reduce((acc, time) => (60 * acc) + +time)) + 1));
                    }
                } else {
                    setTimeTaken(prev => formatTime(parseInt(prev.split(':').reduce((acc, time) => (60 * acc) + +time)) + 1));
                }
            }, 1000);
        }

        return () => clearInterval(timer);
    }, [currentTask, isPaused, currentCountdown]);

    useEffect(() => {
        let overtimeTimer;
        if (isOvertime) {
          overtimeTimer = setInterval(() => {
            const [hours, minutes, seconds] = currentCountdown.split(':').map(Number);
            const newSeconds = seconds + 1 === 60 ? 0 : seconds + 1;
            const newMinutes = seconds + 1 === 60 ? (minutes + 1 === 60 ? 0 : minutes + 1) : minutes;
            const newHours = seconds + 1 === 60 && minutes + 1 === 60 ? hours + 1 : hours;
            setCurrentCountdown(`${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`);
          }, 1000);
        }
    
        return () => clearInterval(overtimeTimer);
    }, [isOvertime, currentCountdown]);

    const handleNextTask = () => {
        const updatedCurrentTask = {
            ...currentTask,
            timeTaken: timeTaken,
        };

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
                                tasks: [...column.tasks, updatedCurrentTask],
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

        const todayTasks = updatedLists.find(list => list.title === currentList.title).columns.find(column => column.id === 'today').tasks;

        if (todayTasks.length > 0) {
            const nextTaskIndex = todayTasks.findIndex(task => task.id === currentTask.id) + 1;
            if (nextTaskIndex < todayTasks.length) {
                setCurrentTaskIndex(nextTaskIndex);
                setCurrentTask(todayTasks[nextTaskIndex]);
                setCurrentCountdown(todayTasks[nextTaskIndex].time + ':00:00');
                setTimeTaken(todayTasks[nextTaskIndex].timeTaken + ':00');
            } else {
                handleBack();
            }
        } else {
            handleBack();
        }
    };

    const selectTask = (index) => {
        setCurrentTaskIndex(index);
        setCurrentTask(todayTasks[index]);
        setCurrentCountdown(todayTasks[index].time + ':00');
    }

    const handleFocus = () => {
        setFocused(true);
        invoke('set_window_size', { size: 'focus' });
    }

    const handleUnFocus = () => {
        setFocused(false);
        invoke('set_window_size', { size: 'small' });
        setIsHovering(false);
    }

    if (focused) {
        return (
            <div onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} className="flex flex-col bg-border h-screen w-screen">
                <div data-tauri-drag-region className={`border border-secondary absolute w-full h-screen flex flex-row items-center justify-between p-4 `}>
                        <h3 className='font-medium'>{currentTask.title}</h3>
                        { todayTasks[0].time !== '00:00' ?
                            <p className='text-copy-light font-bold text-lg'>{currentCountdown}</p>
                        :
                            <p className='text-copy-light font-bold text-lg'>{timeTaken}</p>
                        }
                </div>
                
                <div data-tauri-drag-region className={`gap-2 border bg-border border-secondary absolute w-full h-screen flex flex-row items-center justify-between p-4 transition-opacity duration-200 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
                    <div></div>
                    <div className='flex flex-row items-center text-copy-light gap-2'>
                        <button onClick={() => handleNextTask()}>
                            <CircleCheck className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        { !isPaused ? 
                        <button onClick={() => setIsPaused(true)}>
                            <PauseCircle className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        :
                        <button onClick={() => setIsPaused(false)}>
                            <PlayCircle className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        }
                        <button onClick={() => handleUnFocus()}>
                            <Expand className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                    </div>
                    <div></div>
                </div>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-screen w-screen p-8">
            <div className="flex items-center justify-between mt-4">
                <h1 className='text-3xl font-bold'>Today</h1>
                <button onClick={() => handleBack()} className='flex flex-row font-bold text-copy-lighter hover:text-copy-light'>
                    <ChevronLeft className='w-6 h-6' />
                    BACK
                </button>
            </div>

            <div className='flex flex-col flex-grow gap-2'>
                <div 
                    onMouseEnter={() => setIsHovering(true)} 
                    onMouseLeave={() => setIsHovering(false)} 
                    className={`border border-secondary flex flex-row items-center justify-between bg-border rounded-lg p-4 mt-7 gap-2`}
                >
                    <h3 className='font-medium overflow-hidden truncate text-ellipsis'>{currentTask.title}</h3>
                    { todayTasks[0].time !== '00:00' ?
                        <p className={`text-copy-light font-bold text-lg transition-opacity duration-300`}>{currentCountdown}</p>
                    :
                        <p className={`text-copy-light font-bold text-lg transition-opacity duration-300`}>{timeTaken}</p>
                    }


                    <div className={`left-12 right-12 justify-center absolute flex flex-row items-center bg-border text-copy-light gap-2 py-1 transition-opacity duration-300 ${isHovering ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={() => handleNextTask()}>
                            <CircleCheck className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        { !isPaused ? 
                        <button onClick={() => setIsPaused(true)}>
                            <PauseCircle className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        :
                        <button onClick={() => setIsPaused(false)}>
                            <PlayCircle className='w-5 h-5 hover:text-secondary duration-100' />
                        </button>
                        }
                    </div>
                </div>

                {todayTasks.map((task, index) => (
                    index !== currentTaskIndex && (
                        <button onClick={() => selectTask(index)} key={task.id} className={`w-full flex flex-row justify-between bg-border rounded-lg px-4 py-3`}>
                            <h3 className='font-medium'>{task.title}</h3>
                        </button>
                    )
                ))}

                <AddTask onAddTask={(task) => handleAddTask(task)}/>
                
                {doneTasks.length > 0 && (
                    <>
                        <h1 className='font-semibold text-md w-full'>{doneTasks.length} Done</h1>
                        {doneTasks.slice(0,5).map((task, index) => (
                            <div key={task.id} className="bg-border rounded-lg p-3 flex items-center gap-2 -mb-1">
                                <CircleCheck className="w-4 h-4 text-primary" />
                                <h3 className="font-medium text-sm line-through">{task.title}</h3>
                            </div>
                        ))}
                    </>
                )}
            </div>

            <button onClick={() => handleFocus()} className='my-4 font-bold tracking-wider text-background rounded-lg py-2 w-full bg-gradient-to-r from-primary to-secondary hover:-translate-y-1 duration-100'>
                Focus
            </button>
        </div>
    );
};

export default Timer;