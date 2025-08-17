
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';
import IdPage from './IdPage';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div><h1>Vite + React</h1></div>} />
        <Route path=":id" element={<IdPage />} />
      </Routes>
    </Router>
  );
}

export default App;
