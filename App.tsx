
import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import TrainingDashboard from './components/TrainingDashboard';
import ChessArena from './components/ChessArena';

type View = 'card' | 'training' | 'chess';

function App() {
  const [currentView, setCurrentView] = useState<View>('card');

  const handleSwitchView = (view: View) => {
    setCurrentView(view);
  };

  return (
    <div className="App">
      {currentView === 'card' && <GameBoard onSwitchView={handleSwitchView} />}
      {currentView === 'training' && <TrainingDashboard onSwitchView={handleSwitchView} />}
      {currentView === 'chess' && <ChessArena onSwitchView={handleSwitchView} />}
    </div>
  );
}

export default App;
