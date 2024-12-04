import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useList } from '../../context/ListContext';
import List from '../../components/List';
import Flow from '../../components/Flow';
import Navbar from '../../components/Navbar';

const Home = () => {    
    const { lists, setCurrentList, createNewList, setLists } = useList();
    const navigate = useNavigate();

    const handleLoadList = (list) => {
        setCurrentList(list);
        navigate('/list');
    };

    const handleCreateList = () => {
        createNewList('Untitled');
        navigate('/list');
    };

    const onDragEnd = (result) => {
        const { destination, source } = result;

        if (!destination) return;

        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const reorderedLists = Array.from(lists);
        const [movedList] = reorderedLists.splice(source.index, 1);
        reorderedLists.splice(destination.index, 0, movedList);

        setLists(reorderedLists);
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
            
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="lists" direction="horizontal">
                    {(provided) => (
                        <div
                            className="px-10 mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-scroll no-scrollbar pb-24"
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                        >
                            {lists.map((list, index) => (
                                <Draggable key={list.id} draggableId={list.id} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                        >
                                            <List list={list} handleLoadList={handleLoadList} />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>

            <Navbar handleCreateList={handleCreateList}/>
        </div>
    );
}

export default Home;