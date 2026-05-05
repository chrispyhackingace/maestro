import React from 'react';
import './App.css';
import HandTracker from './components/HandTracker';

const App = () => {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>throwing hands</h1>
      </header>
      <main className="app-main">
        <HandTracker />
      </main>
    </div>
  );
};

export default App;
