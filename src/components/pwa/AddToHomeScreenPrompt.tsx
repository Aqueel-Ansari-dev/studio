'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'fieldops_a2hs_prompt_shown';

export function AddToHomeScreenPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      
      const hasBeenShown = localStorage.getItem(LOCAL_STORAGE_KEY);
      
      // Only show the prompt if it hasn't been shown before
      if (!hasBeenShown) {
        setInstallPromptEvent(event);
        setIsDialogOpen(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    // Show the browser's install prompt
    await installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    await installPromptEvent.userChoice;
    
    // We've shown the prompt, so we can hide our dialog
    setIsDialogOpen(false);
    
    // Set flag in local storage so we don't show it again
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');

    // Clear the saved prompt event
    setInstallPromptEvent(null);
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    // Set the flag even if they cancel, so it's a one-time offer per device.
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
  };

  if (!isDialogOpen || !installPromptEvent) {
    return null;
  }

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install FieldOps MVP App
          </AlertDialogTitle>
          <AlertDialogDescription>
            For a better experience, add this application to your home screen. It's fast, works offline, and feels like a native app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Maybe Later</AlertDialogCancel>
          <AlertDialogAction onClick={handleInstallClick} className="bg-primary hover:bg-primary/90">
            Install
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
