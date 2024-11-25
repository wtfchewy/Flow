import React from 'react';
import Flow from '../../components/Flow';
import Navbar from '../../components/Navbar';

const Settings = () => {

    const handleCreateList = () => {
        createNewList('Untitled');
        navigate('/list');
    };

    async function setTheme(themeName) {
        const response = await fetch(`./themes/${themeName}.json`);
        const theme = await response.json();
      
        Object.keys(theme).forEach(key => {
          document.documentElement.style.setProperty(`--color-${key}`, theme[key]);
        });
    }


    return (
        <div className="flex flex-col w-full h-screen">
            <div className="mb-6 mt-4 flex flex-row w-full items-center h-20 px-10">
                <Flow />
            </div>

            <div className="mx-10 flex flex-row items-center justify-between border-b border-border pb-3">
                <h1 className="font-bold text-xl">Settings</h1>
                <p className="font-light text-copy-light">Personalize your experience and manage your preferences</p>
            </div>

            {/* SET THEME */}
            <div className="px-10 mt-8 flex flex-col w-1/3">
                <h1 className="font-bold text-2xl">Appearance</h1>
                <p className="font-light text-copy-light mb-2">Change the appearance of the app</p>
                <div className="flex flex-row mt-3 bg-foreground p-3 rounded-lg gap-3">
                    <button onClick={() => setTheme('light')} className="w-8 h-8 rounded-full bg-[#edecf3] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
                    <button onClick={() => setTheme('dark')} className="w-8 h-8 rounded-full bg-[#17161d] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
                    <button onClick={() => setTheme('discordish')} className="w-8 h-8 rounded-full bg-[#131420] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
                </div>
                
            </div>

            <Navbar handleCreateList={handleCreateList}/>
        </div>
    )
}

export default Settings;