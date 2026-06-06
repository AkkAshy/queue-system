'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  muted: boolean;
  onToggle: () => void;
}

export function MuteButton({ muted, onToggle }: Props) {
  return (
    <Button
      onClick={onToggle}
      variant="outline"
      size="icon"
      aria-label={muted ? 'Unmute' : 'Mute'}
      className="h-12 w-12 border-hair-2 bg-card text-coal-2 hover:text-coral"
    >
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </Button>
  );
}
