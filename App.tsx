
import React, { useState } from 'react';
import GameBoard from './components/GameBoard';
import TrainingDashboard from './components/TrainingDashboard';

type View = 'game' | 'training';

function App() {
  const [currentView, setCurrentView] = useState<View>('game');

  const handleSwitchView = (view: View) => {
    setCurrentView(view);
  };

  return (
    <div className="App">
      {currentView === 'game' ? (
        <GameBoard onSwitchView={handleSwitchView} />
      ) : (
        <TrainingDashboard onSwitchView={handleSwitchView} />
      )}
    </div>
  );
}

export default App;
