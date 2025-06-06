"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrainingMaterial } from '@/app/actions/training/getTrainingMaterials';
import { getTrainingMaterials } from '@/app/actions/training/getTrainingMaterials';

export default function TrainingPage() {
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);

  useEffect(() => {
    async function load() {
      const data = await getTrainingMaterials();
      setMaterials(data);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Training Materials" description="Access task-specific training materials." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {materials.map((mat) => (
          <Card key={mat.id}>
            <CardHeader>
              <CardTitle className="font-headline text-xl">{mat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">{mat.description}</p>
              <p className="text-xs text-muted-foreground">Category: {mat.category}</p>
            </CardContent>
          </Card>
        ))}
        {materials.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No training materials found.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
