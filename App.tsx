import { useState } from 'react';
import GameBoard from './components/GameBoard';
import TrainingDashboard from './components/TrainingDashboard';

export type AppView = 'card' | 'training' | 'chess' | 'shooter';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('card');

  if (currentView === 'training') {
    return <TrainingDashboard onSwitchView={setCurrentView} />;
  }

  return <GameBoard onSwitchView={setCurrentView} />;
}
