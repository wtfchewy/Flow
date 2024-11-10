import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ListView, Home } from './pages';
import { ListProvider } from './context/ListContext';


function App() {


  return (
    <ListProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list" element={<ListView />} />
        </Routes>
      </Router>
    </ListProvider>
  );
}

export default App;