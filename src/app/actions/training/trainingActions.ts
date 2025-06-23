
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, writeBatch, serverTimestamp, getDocs, query, doc, deleteDoc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import type { TrainingMaterial, UserWatchedTraining } from '@/types/database';

// Helper to extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Helper to fetch video metadata from YouTube's oEmbed endpoint
async function getYouTubeVideoData(videoUrl: string): Promise<{ title: string; thumbnailUrl: string } | null> {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
        if (!response.ok) {
            console.error(`Failed to fetch oEmbed data for ${videoUrl}, status: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return {
            title: data.title || "Untitled Video",
            thumbnailUrl: data.thumbnail_url || ""
        };
    } catch (error) {
        console.error(`Error fetching oEmbed data for ${videoUrl}:`, error);
        return null;
    }
}

const AddTrainingModuleSchema = z.object({
  videoUrls: z.array(z.string().url()).min(1, 'At least one video URL is required.'),
  category: z.string().min(1, 'Category is required.'),
  description: z.string().optional(),
});

export type AddTrainingModuleInput = z.infer<typeof AddTrainingModuleSchema>;

export async function addTrainingModule(adminId: string, input: AddTrainingModuleInput) {
  const validation = AddTrainingModuleSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, message: 'Invalid input.', errors: validation.error.flatten().fieldErrors };
  }

  const { videoUrls, category, description } = validation.data;
  const batch = writeBatch(db);
  let validUrlsCount = 0;
  const errors: string[] = [];

  for (const url of videoUrls) {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) {
      errors.push(`Invalid YouTube URL: ${url}`);
      continue;
    }

    const videoData = await getYouTubeVideoData(url);
    if (!videoData) {
        errors.push(`Could not fetch data for video: ${url}`);
        continue;
    }

    const docRef = doc(collection(db, 'trainingMaterials'));
    const newMaterial: Omit<TrainingMaterial, 'id'> = {
      videoId,
      videoUrl: url,
      title: videoData.title,
      thumbnailUrl: videoData.thumbnailUrl,
      category,
      description: description || '',
      createdBy: adminId,
      createdAt: serverTimestamp() as any,
    };
    batch.set(docRef, newMaterial);
    validUrlsCount++;
  }

  if (validUrlsCount === 0) {
    return { success: false, message: 'No valid YouTube URLs were provided.', errors };
  }

  try {
    await batch.commit();
    const message = `${validUrlsCount} video(s) published successfully. ${errors.length > 0 ? `${errors.length} failed.` : ''}`;
    return { success: true, message, errors: errors.length > 0 ? errors : undefined };
  } catch (error) {
    console.error("Error committing training module batch:", error);
    return { success: false, message: 'Failed to save training videos to the database.' };
  }
}

export async function getTrainingMaterials() {
    try {
        const q = query(collection(db, 'trainingMaterials'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const materials = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: (docSnap.data().createdAt as any).toDate().toISOString(),
        } as TrainingMaterial));
        return { success: true, materials };
    } catch (error) {
        console.error("Error fetching training materials:", error);
        return { success: false, error: 'Failed to fetch training materials.' };
    }
}

export async function deleteTrainingMaterial(adminId: string, materialId: string) {
    // Add admin role check here in a real application
    if (!adminId) return { success: false, message: 'Unauthorized' };
    try {
        await deleteDoc(doc(db, 'trainingMaterials', materialId));
        return { success: true, message: 'Video deleted successfully.' };
    } catch (error) {
        console.error("Error deleting training material:", error);
        return { success: false, message: 'Failed to delete video.' };
    }
}

export async function getWatchedStatusForUser(userId: string) {
    if (!userId) return { success: false, error: 'User ID required' };
    try {
        const snapshot = await getDocs(collection(db, `users/${userId}/watchedTraining`));
        const watchedIds = new Set(snapshot.docs.map(d => d.id));
        return { success: true, watchedIds };
    } catch (error) {
        console.error("Error fetching watched status:", error);
        return { success: false, error: 'Failed to fetch watched status.' };
    }
}

export async function markVideoAsWatched(userId: string, materialId: string) {
    if (!userId || !materialId) return { success: false, message: 'User and Material ID required.' };
    try {
        const watchRecordRef = doc(db, `users/${userId}/watchedTraining`, materialId);
        const watchRecord: Omit<UserWatchedTraining, 'materialId'> = {
            watchedAt: serverTimestamp() as any,
        };
        await setDoc(watchRecordRef, watchRecord);
        return { success: true, message: 'Progress saved.' };
    } catch (error) {
        console.error("Error marking video as watched:", error);
        return { success: false, message: 'Failed to save progress.' };
    }
}
