import { DemoPlayer } from './DemoPlayer';

interface DemoModalProps {
  onClose: () => void;
  initialStep?: number;
}

export function DemoModal({ onClose, initialStep = 0 }: DemoModalProps) {
  return <DemoPlayer isModal onClose={onClose} initialStep={initialStep} />;
}
