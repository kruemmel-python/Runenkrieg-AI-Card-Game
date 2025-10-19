import React from 'react';
import {
  RunenkriegTrainingPanel,
  RunenkriegTrainingProvider,
} from './training/runenkrieg/RunenkriegTrainingPanel';
import { ChessTrainingPanel, ChessTrainingProvider } from './training/chess/ChessTrainingPanel';
import { ShooterTrainingPanel, ShooterTrainingProvider } from './training/shooter/ShooterTrainingPanel';

const TrainingDashboard: React.FC<{ onSwitchView: (view: 'card' | 'training' | 'chess' | 'shooter') => void }> = ({
  onSwitchView,
}) => {
  return (
    <div className="min-h-screen bg-slate-800 py-12 px-6">
      <div className="flex flex-col items-center gap-16">
        <RunenkriegTrainingProvider>
          <RunenkriegTrainingPanel onSwitchView={onSwitchView} />
        </RunenkriegTrainingProvider>

        <ShooterTrainingProvider>
          <ShooterTrainingPanel onSwitchView={onSwitchView} />
        </ShooterTrainingProvider>

        <ChessTrainingProvider>
          <ChessTrainingPanel onSwitchView={onSwitchView} />
        </ChessTrainingProvider>
      </div>
    </div>
  );
};

export default TrainingDashboard;
