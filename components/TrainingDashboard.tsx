import type { AppView } from '../App';
import {
  RunenkriegTrainingPanel,
  RunenkriegTrainingProvider,
} from './training/runenkrieg/RunenkriegTrainingPanel';

interface TrainingDashboardProps {
  onSwitchView: (view: AppView) => void;
}

export default function TrainingDashboard({ onSwitchView }: TrainingDashboardProps) {
  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 safe-top safe-bottom sm:px-6">
      <RunenkriegTrainingProvider>
        <RunenkriegTrainingPanel onSwitchView={onSwitchView} />
      </RunenkriegTrainingProvider>
    </main>
  );
}
