import MlOverviewPage from '@/components/ml/MlOverviewPage';
import { TeamProvider } from '@/contexts/TeamContext';

export default function Ml() {
  return (
    <TeamProvider>
      <MlOverviewPage />
    </TeamProvider>
  );
}
