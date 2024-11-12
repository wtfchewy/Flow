import React from 'react';
import { HomeIcon, Plus, Settings } from "lucide-react"; 
import { NavLink, useNavigate } from "react-router-dom";
import { useList } from '../../context/ListContext';
import List from '../../components/List';
import Flow from '../../components/Flow';

const Home = () => {    
    const { lists, setCurrentList, createNewList } = useList();
    const navigate = useNavigate();

    const handleLoadList = (list) => {
        setCurrentList(list);
        navigate('/list');
    };

    const handleCreateList = () => {
        createNewList('Untitled');
        navigate('/list');
    };

    return (
        <>
            <div className="flex flex-col w-full h-screen bg-background">
                <div className='flex flex-col w-full h-full  px-10'>
                    <div className="flex flex-row w-full items-center h-20">
                        <Flow />
                    </div>

                    <div className="w-full flex-grow">
                        <div className="flex flex-row items-center justify-between">
                            <h1 className="font-bold text-xl">Your Lists</h1>
                            <p className="font-light text-zinc-400">Lists with your upcoming tasks</p>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {lists.map((list) => (
                                <List key={list.id} list={list} handleLoadList={handleLoadList} />
                            ))}

                            <div className="flex flex-col items-center justify-center">
                                <button onClick={handleCreateList} className="duration-200 text-zinc-500 hover:border-primary hover:text-primary items-center justify-center flex flex-col bg-column border-2 border-zinc-700 border-dashed rounded-lg w-full h-80 p-3">
                                    <Plus className="w-8 h-8 mb-3" />
                                    <h1 className="text-xl font-bold">CREATE LIST</h1>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='flex flex-row justify-between bg-column items-center px-10 py-5'>
                    <div className='flex flex-row items-center gap-4'>
                        <NavLink to="/" className="rounded-lg bg-task px-3 py-2 text-zinc-500 hover:text-primary duration-200 flex flex-row gap-1 items-center">
                            <HomeIcon className="w-5 h-5" />
                            <h1 className="text-m font-medium">Home</h1>
                        </NavLink>
                        <NavLink to="/settings" className="rounded-lg bg-task px-3 py-2 text-zinc-500 hover:text-primary duration-200 flex flex-row gap-1 items-center">
                            <Settings className="w-5 h-5" />
                            <h1 className="text-m font-medium">Settings</h1>
                        </NavLink>
                    </div>

                    <button className='bg-gradient-to-r from-primary to-secondary text-column rounded-md font-semibold px-6 py-2 hover:-translate-y-1 transition-transform duration-200'>
                        Create Quick List
                    </button>
                </div>
            </div>
        </>
    );
}

export default Home;