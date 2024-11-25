import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ListView, Home, Timer, Settings } from './pages';
import { ListProvider } from './context/ListContext';
import { dark } from './utils/themes';

function App() {
  useEffect(() => {
      Object.keys(dark).forEach(key => { 
          document.documentElement.style.setProperty(`--color-${key}`, dark[key]);
      });
  }, []);

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