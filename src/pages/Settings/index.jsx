import React from 'react';
import { load } from '@tauri-apps/plugin-store';
import Flow from '../../components/Flow';
import Navbar from '../../components/Navbar';
import { dark, light, discordish, bluey, reptile } from '../../utils/themes';

const Settings = ({ setTheme }) => {

  const handleDeleteData = async () => {
    const settings = await load('settings.json');
    const lists = await load('store.json');
    await settings.clear();
    await lists.clear();
    await settings.save();
    await lists.save();
  };

  const handleCreateList = () => {
    createNewList('Untitled');
    navigate('/list');
  };

  async function handleSetTheme(themeName) {
    let theme;
    switch (themeName) {
      case 'dark':
        theme = dark;
        break;
      case 'light':
        theme = light;
        break;
      case 'discordish':
        theme = discordish;
        break;
      case 'bluey':
        theme = bluey;
        break;
      case 'reptile':
        theme = reptile;
        break;
      default:
        console.error(`Theme ${themeName} not found`);
        return;
    }

    const store = await load('settings.json');
    await store.set('theme', theme);
    await store.save();

    setTheme(theme);
  }

  return (
    <div className="flex flex-col w-full h-screen">
      <div className="mb-6 mt-4 flex flex-row w-full items-center h-20 px-10">
        <Flow />
      </div>

      <div className="mx-10 flex flex-row items-center justify-between border-b border-border pb-3 duration-200">
        <h1 className="font-bold text-xl">Settings</h1>
        <p className="font-light text-copy-light">Personalize your experience and manage your preferences</p>
      </div>

      
      <div className='px-10 mt-8 w-full flex flex-row gap-3'>
        <div className="flex flex-col w-1/3">
          <h1 className="font-bold text-2xl">Data</h1>
          <p className="font-light text-copy-light mb-2">Manage your data and settings</p>

          <div className='flex flex-col bg-foreground p-3 rounded-lg'>
            <h1 className="font-bold text-lg">Delete All Data</h1>
            <button onClick={() => handleDeleteData()} className='mt-2 bg-error rounded-lg py-2'>
              <p className="font-semibold text-error-content">Delete all data and settings</p>
            </button>
          </div>
        </div>

        <div className="flex flex-col w-1/3">
          <h1 className="font-bold text-2xl">Appearance</h1>
          <p className="font-light text-copy-light mb-2">Change the appearance of the app</p>

          <div className='flex flex-col bg-foreground p-3 rounded-lg'>
            <h1 className="font-bold text-lg">Themes</h1>
            <div className="flex flex-row mt-2 gap-3">
              <button onClick={() => handleSetTheme('light')} className="w-8 h-8 rounded-full bg-[#edecf3] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
              <button onClick={() => handleSetTheme('dark')} className="w-8 h-8 rounded-full bg-[#17161d] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
              <button onClick={() => handleSetTheme('discordish')} className="w-8 h-8 rounded-full bg-[#131420] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
              <button onClick={() => handleSetTheme('bluey')} className="w-8 h-8 rounded-full bg-[#111d22] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
              <button onClick={() => handleSetTheme('reptile')} className="w-8 h-8 rounded-full bg-[#141f18] border border-border hover:border-primary hover:border-2 hover:-translate-y-1 transition-transform duration-200"/>
            </div>
          </div>

          <div className='flex flex-col bg-foreground p-3 rounded-lg mt-3'>
            <h1 className="font-bold text-lg">Layout</h1>
            <div className="flex flex-row mt-2 gap-1 bg-border rounded-lg p-1">
              <button className='rounded-lg bg-primary text-primary-content px-3 py-2 font-bold'>
                Default
              </button>
              <button className='px-3 py-2 font-bold hover:bg-foreground duration-200 rounded-lg'>
                Compact
              </button>
              <button className='px-3 py-2 font-bold hover:bg-foreground duration-200 rounded-lg'>
                Cozy
              </button>
            </div>
          </div>
        </div>
      </div>

      <Navbar handleCreateList={handleCreateList}/>
    </div>
  );
}

export default Settings;