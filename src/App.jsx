import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ListView, Home, Timer, Settings } from './pages';
import { ListProvider } from './context/ListContext';

function App() {
  async function setTheme(themeName) {
    const response = await fetch(`./themes/${themeName}.json`);
    const theme = await response.json();
  
    Object.keys(theme).forEach(key => {
      document.documentElement.style.setProperty(`--color-${key}`, theme[key]);
    });
  }
  
  setTheme('dark');

  return (
    <ListProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/list" element={<ListView />} />
          <Route path='/timer' element={<Timer />} />
        </Routes>
      </Router>
    </ListProvider>
  );
}

export default App;