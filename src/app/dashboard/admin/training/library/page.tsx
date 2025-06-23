
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { getTrainingMaterials, deleteTrainingMaterial, getWatchedStatusForUser } from '@/app/actions/training/trainingActions';
import type { TrainingMaterial } from '@/types/database';
import Image from 'next/image';
import { formatDistanceToNow, isWithinInterval, subDays } from 'date-fns';
import { GraduationCap, Trash2, Search, Check, RefreshCw, Eye, PlusCircle } from 'lucide-react';
import { VideoPlayer } from '@/components/training/VideoPlayer';
import Link from 'next/link';

export default function TrainingLibraryAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [selectedVideo, setSelectedVideo] = useState<TrainingMaterial | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  
  const [videoToDelete, setVideoToDelete] = useState<TrainingMaterial | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [materialsResult, watchedResult] = await Promise.all([
        getTrainingMaterials(),
        user ? getWatchedStatusForUser(user.id) : Promise.resolve({ success: false, watchedIds: new Set() })
      ]);

      if (materialsResult.success && materialsResult.materials) {
        setMaterials(materialsResult.materials);
      } else {
        toast({ title: 'Error', description: 'Could not load training materials.', variant: 'destructive' });
      }

      if (watchedResult.success && watchedResult.watchedIds) {
        setWatchedIds(watchedResult.watchedIds);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const categories = useMemo(() => {
    const cats = new Set(materials.map(m => m.category));
    return Array.from(cats);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesCategory = selectedCategory ? m.category === selectedCategory : true;
      const matchesSearch = searchQuery ? 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.description?.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      return matchesCategory && matchesSearch;
    });
  }, [materials, selectedCategory, searchQuery]);

  const handleWatchComplete = (materialId: string) => {
    setWatchedIds(prev => new Set(prev).add(materialId));
  };
  
  const handleDeleteClick = (material: TrainingMaterial) => {
    setVideoToDelete(material);
  };
  
  const confirmDelete = async () => {
    if (!videoToDelete || !user) return;
    setIsDeleting(true);
    const result = await deleteTrainingMaterial(user.id, videoToDelete.id);
    if (result.success) {
      toast({ title: 'Video Deleted', description: result.message });
      setMaterials(prev => prev.filter(m => m.id !== videoToDelete.id));
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsDeleting(false);
    setVideoToDelete(null);
  };

  const renderVideoCard = (material: TrainingMaterial) => {
    const isNew = isWithinInterval(new Date(material.createdAt as string), {
      start: subDays(new Date(), 7),
      end: new Date(),
    });
    const isWatched = watchedIds.has(material.id);

    return (
      <Card key={material.id} className="overflow-hidden group flex flex-col">
        <button
          onClick={() => { setSelectedVideo(material); setShowPlayer(true); }}
          className="relative block"
        >
          <Image src={material.thumbnailUrl} alt={material.title} width={480} height={270} className="w-full aspect-video object-cover" data-ai-hint="youtube thumbnail" />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <GraduationCap className="h-12 w-12 text-white/70" />
          </div>
          {isNew && !isWatched && <Badge className="absolute top-2 left-2">New</Badge>}
          {isWatched && (
            <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center text-white font-bold">
              <Check className="h-8 w-8 mr-2" /> Watched
            </div>
          )}
        </button>
        <CardHeader className="flex-grow">
          <CardTitle className="text-base font-semibold leading-tight">{material.title}</CardTitle>
          <CardDescription className="text-xs line-clamp-2">{material.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardFooter className="text-xs text-muted-foreground justify-between items-center">
          <Badge variant="secondary">{material.category}</Badge>
          {!isPreviewMode && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(material)}>
              <Trash2 className="h-4 w-4"/>
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Library"
        description="Manage and preview all available training videos."
        actions={
          <div className="flex items-center gap-4">
             <div className="flex items-center space-x-2">
              <Switch id="preview-mode" checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
              <Label htmlFor="preview-mode" className="flex items-center gap-1"><Eye className="h-4 w-4"/> Preview as Employee</Label>
            </div>
            <Button asChild><Link href="/dashboard/admin/training/add"><PlusCircle className="mr-2 h-4 w-4"/> Add New Videos</Link></Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant={!selectedCategory ? 'default' : 'outline'} onClick={() => setSelectedCategory(null)}>All</Button>
            {categories.map(cat => (
              <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat)}>{cat}</Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10"><RefreshCw className="h-8 w-8 animate-spin" /></div>
          ) : filteredMaterials.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <p>No training materials match your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMaterials.map(renderVideoCard)}
            </div>
          )}
        </CardContent>
      </Card>
      
      {selectedVideo && (
         <VideoPlayer
          isOpen={showPlayer}
          onOpenChange={setShowPlayer}
          video={selectedVideo}
          onWatchComplete={handleWatchComplete}
        />
      )}

      {videoToDelete && (
        <AlertDialog open={!!videoToDelete} onOpenChange={() => setVideoToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this video?</AlertDialogTitle>
              <AlertDialogDescription>
                "{videoToDelete.title}" will be permanently removed from the training library for all users. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? "Deleting..." : "Delete Video"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
