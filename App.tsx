import { useState } from 'react';
import GameBoard from './components/GameBoard';
import TrainingDashboard from './components/TrainingDashboard';

export type AppView = 'card' | 'training';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('card');

  return currentView === 'training' ? (
    <TrainingDashboard onSwitchView={setCurrentView} />
  ) : (
    <GameBoard onSwitchView={setCurrentView} />
  );
}
