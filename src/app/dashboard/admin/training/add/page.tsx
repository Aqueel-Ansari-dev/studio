
"use client";

import { useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/context/auth-context';
import { addTrainingModule } from '@/app/actions/training/trainingActions';
import { PlusCircle, Trash2, BookOpen, Send, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UrlInput {
  id: string;
  value: string;
  error?: string;
}

const trainingCategories = ["Safety", "Equipment", "HR", "Compliance", "Other"];

export default function AddTrainingPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [urlInputs, setUrlInputs] = useState<UrlInput[]>([{ id: crypto.randomUUID(), value: '' }]);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleUrlChange = (id: string, value: string) => {
    setUrlInputs(inputs => inputs.map(input => input.id === id ? { ...input, value, error: undefined } : input));
  };

  const handleAddRow = () => {
    setUrlInputs(inputs => [...inputs, { id: crypto.randomUUID(), value: '' }]);
  };
  
  const handleRemoveRow = (id: string) => {
    if (urlInputs.length > 1) {
      setUrlInputs(inputs => inputs.filter(input => input.id !== id));
    }
  };

  const validateUrls = () => {
    let isValid = true;
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const updatedInputs = urlInputs.map(input => {
      if (input.value.trim() && !youtubeRegex.test(input.value)) {
        isValid = false;
        return { ...input, error: 'Invalid YouTube URL' };
      }
      return { ...input, error: undefined };
    });
    setUrlInputs(updatedInputs);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'Not Authenticated', variant: 'destructive' });
      return;
    }
    if (!validateUrls()) {
      toast({ title: 'Invalid URLs', description: 'Please correct the invalid YouTube video links.', variant: 'destructive' });
      return;
    }

    const finalCategory = category === 'Other' ? customCategory : category;
    if (!finalCategory) {
      toast({ title: 'Category Required', description: 'Please select or enter a category.', variant: 'destructive' });
      return;
    }

    const urlsToSubmit = urlInputs.map(input => input.value).filter(Boolean);
    if (urlsToSubmit.length === 0) {
      toast({ title: 'No URLs', description: 'Please provide at least one video URL.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    const result = await addTrainingModule(user.id, {
      videoUrls: urlsToSubmit,
      category: finalCategory,
      description,
    });
    
    if (result.success) {
      toast({ title: 'Module Published', description: result.message });
      router.push('/dashboard/admin/training/library');
    } else {
      toast({ title: 'Publishing Failed', description: result.message, variant: 'destructive' });
      if (result.errors) {
        console.error("Failed URLs:", result.errors);
      }
    }
    setIsSubmitting(false);
  };
  
  return (
    <div className="space-y-6">
      <PageHeader title="Add Training Videos" description="Publish a new training module by adding YouTube video links." />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2"><BookOpen/> New Training Module</CardTitle>
          <CardDescription>All videos added here will be grouped into a single module under the category you select.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="font-semibold">1. Add Video URLs</Label>
            <div className="space-y-3">
              {urlInputs.map((input, index) => (
                <div key={input.id} className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="Paste YouTube video URL here..."
                    value={input.value}
                    onChange={e => handleUrlChange(input.id, e.target.value)}
                    className={input.error ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveRow(input.id)} disabled={urlInputs.length === 1}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  {input.error && <p className="text-xs text-destructive">{input.error}</p>}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddRow} className="mt-2 border-dashed">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Another Video
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category" className="font-semibold">2. Select a Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category"><SelectValue placeholder="Choose a category..." /></SelectTrigger>
                <SelectContent>
                  {trainingCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              {category === 'Other' && (
                <Input
                  placeholder="Enter custom category name"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold">3. Module Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="A brief description of what this module covers."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting || authLoading}>
            {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
            {isSubmitting ? 'Publishing...' : 'Publish Module'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
