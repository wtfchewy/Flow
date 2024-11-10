import React from 'react';
import { Plus } from "lucide-react"; 
import { NavLink, useNavigate } from "react-router-dom";
import { useList } from '../../context/ListContext';

const Home = () => {    
    const { blankList, lists, setCurrentList } = useList();
    const navigate = useNavigate();

    const handleLoadList = (list) => {
        setCurrentList(list);
        navigate('/list');
    };

    const handleCreateList = () => {
        setCurrentList(blankList); // Set the blank list as the current list
        navigate('/list'); // Navigate to the blank list
    };

    const estimatedTime = (tasks) => {
        let total = 0;
        tasks.forEach(task => {
            const time = task.time.split(':');
            total += parseInt(time[0]) * 60 + parseInt(time[1]);
        });
        return total;
    }

    const convertTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}hr ${remainingMinutes}min`;
    }

    return (
        <div className="flex flex-col w-full h-screen bg-background px-10">
            <div className="flex flex-row w-full items-center h-20">
                <h1 className="text-4xl text-white font-bold">Flow.</h1>
            </div>

            <div className="w-full flex-grow">
                <div className="flex flex-row items-center justify-between">
                    <h1 className="font-bold text-xl">Your Lists</h1>
                    <p className="font-light text-zinc-400">Lists with your upcoming tasks</p>
                </div>

                <div className="mt-5 grid grid-cols-3">

                    {lists.map((list) => (
                        <button onClick={() => handleLoadList(list)} className="hover:border-indigo-500 flex flex-col bg-column border border-zinc-700 rounded-lg w-80 h-80 p-3">
                            <h1 className="font-semibold text-lg">{list.title}</h1>
    
                            <div className="w-full flex flex-col gap-2 mt-3 flex-grow">
                                {list.columns.map(column => column.tasks.map((task, index) => (
                                    <div className="w-full flex flex-row items-center gap-4 bg-task rounded-lg px-3 py-2">
                                        <span className='text-sm text-zinc-600'>{index + 1}</span>
                                        <h3 className="text-left text-md flex-grow font-medium text-white">{task.title}</h3>
                                        <span className="text-zinc-400 font-light text-sm">{task.time}</span>
                                    </div>
                                )))}
                            </div>
    
                            <div className="w-full flex flex-row items-center justify-between mt-3">
                                <button className="text-zinc-600 font-semibold text-xs">{list.columns.reduce((total, column) => total + column.tasks.length, 0)} pending tasks</button>
                                <button className="text-zinc-600 font-semibold text-xs">Est: {convertTime(estimatedTime(list.columns.flatMap(column => column.tasks)))}</button>
                            </div>
                        </button>
                    ))}

                    <button onClick={() => handleCreateList()} className="text-zinc-500 hover:border-indigo-500 hover:text-indigo-500 items-center justify-center flex flex-col bg-column border-2 border-zinc-700 border-dashed rounded-lg w-80 h-80 p-3">
                        <Plus className="w-8 h-8 mb-3" />
                        <h1 className="text-xl font-bold">CREATE LIST</h1>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Home;