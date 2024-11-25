import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ListView, Home, Timer, Settings } from './pages';
import { ListProvider } from './context/ListContext';
import { load } from '@tauri-apps/plugin-store';
import { dark } from './utils/themes';

function App() {
  const [theme, setTheme] = useState(dark);

  const getTheme = async () => {
    const store = await load('settings.json');
    const storedTheme = await store.get('theme');

    if (storedTheme) {
      console.log('Theme loaded');
      setTheme(storedTheme);
    } else {
      console.log('Theme set');
      await store.set('theme', dark);
      await store.save();
    }
  }

  useEffect(() => {
    getTheme();
  }, []);

  useEffect(() => {
    Object.keys(theme).forEach(key => {
      document.documentElement.style.setProperty(`--color-${key}`, theme[key]);
    });
  }, [theme]);

  return (
    <ListProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings setTheme={setTheme} />} />
          <Route path="/list" element={<ListView />} />
          <Route path='/timer' element={<Timer />} />
        </Routes>
      </Router>
    </ListProvider>
  );
}

export default App;