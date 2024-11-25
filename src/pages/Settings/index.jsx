import React from 'react';
import Flow from '../../components/Flow';
import Navbar from '../../components/Navbar';

const Settings = () => {

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
                <h1 className="font-bold text-xl">Settings</h1>
                <p className="font-light text-copy-light">Personalize your experience and manage your preferences</p>
            </div>

            {/* <div className='mt-5 flex flex-col px-10 w-1/3'>
                <h1 className=''>Appearance</h1>
                <div className='mt-4 flex flex-row items-center justify-between'>
                    <p className='text-copy-light'>Theme</p>
                    <div className='flex flex-row items-center gap-2'>
                        <div className='w-8 h-8 bg-primary rounded-full'></div>
                        <div className='w-8 h-8 bg-background rounded-full'></div>
                        <div className='w-8 h-8 bg-background rounded-full'></div>
                    </div>
                </div>
            </div> */}

            <Navbar handleCreateList={handleCreateList}/>
        </div>
    )
}

export default Settings;