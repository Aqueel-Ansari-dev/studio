
"use client";

import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import YouTube from 'react-youtube';
import type { YouTubePlayer } from 'react-youtube';
import type { TrainingMaterial } from '@/types/database';
import { useAuth } from '@/context/auth-context';
import { markVideoAsWatched } from '@/app/actions/training/trainingActions';
import { useToast } from '@/hooks/use-toast';

interface VideoPlayerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  video: TrainingMaterial | null;
  onWatchComplete: (materialId: string) => void;
}

export function VideoPlayer({ isOpen, onOpenChange, video, onWatchComplete }: VideoPlayerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasBeenMarked, setHasBeenMarked] = useState(false);

  useEffect(() => {
    // Reset completion status when a new video is loaded or the sheet is closed
    if (!isOpen || !video) {
      setHasBeenMarked(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [isOpen, video]);

  const onPlayerReady = (event: { target: YouTubePlayer }) => {
    playerRef.current = event.target;
  };

  const onPlayerStateChange = (event: { data: number }) => {
    // Player state codes: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    if (event.data === 1 && !hasBeenMarked) { // Video is playing
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      progressIntervalRef.current = setInterval(async () => {
        const player = playerRef.current;
        if (player && user && video) {
          const currentTime = await player.getCurrentTime();
          const duration = await player.getDuration();
          if (duration > 0 && (currentTime / duration) >= 0.95 && !hasBeenMarked) {
            setHasBeenMarked(true); // Prevent multiple calls
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            const result = await markVideoAsWatched(user.id, video.id);
            if (result.success) {
              onWatchComplete(video.id);
              toast({ title: 'Progress Saved', description: `"${video.title}" marked as watched.` });
            } else {
              toast({ title: 'Error', description: 'Could not save watch progress.', variant: 'destructive' });
              setHasBeenMarked(false); // Allow retrying
            }
          }
        }
      }, 2000); // Check every 2 seconds
    } else { // Video is paused, ended, etc.
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  };

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      modestbranding: 1,
      rel: 0,
    },
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0 flex flex-col">
        {video && (
          <>
            <SheetHeader className="p-4 border-b">
              <SheetTitle>{video.title}</SheetTitle>
              <SheetDescription>{video.description || `Category: ${video.category}`}</SheetDescription>
            </SheetHeader>
            <div className="w-full aspect-video bg-black">
              <YouTube
                videoId={video.videoId}
                opts={opts}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                className="w-full h-full"
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
