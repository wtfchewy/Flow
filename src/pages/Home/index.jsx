import React from 'react';
import { useNavigate } from "react-router-dom";
import { useList } from '../../context/ListContext';
import List from '../../components/List';
import Flow from '../../components/Flow';
import Navbar from '../../components/Navbar';

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
        <div className="flex flex-col w-full h-screen">
            <div className="mb-6 mt-4 flex flex-row w-full items-center h-20 px-10">
                <Flow />
            </div>

            <div className="px-10 flex flex-row items-center justify-between">
                <h1 className="font-bold text-xl">Your Lists</h1>
                <p className="font-light text-copy-light">Lists with your upcoming tasks</p>
            </div>
            
            <div className="px-10 mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-scroll no-scrollbar pb-24">
                {lists.map((list) => (
                    <List key={list.id} list={list} handleLoadList={handleLoadList} />
                ))}
            </div>

            <Navbar handleCreateList={handleCreateList}/>
        </div>
    );
}

export default Home;