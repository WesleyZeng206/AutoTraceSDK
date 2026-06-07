import LlmDetailPage from '@/components/ml/LlmDetailPage';
import { TeamProvider } from '@/contexts/TeamContext';

export default function MlLlm() {
  return (
    <TeamProvider>
      <LlmDetailPage />
    </TeamProvider>
  );
}
