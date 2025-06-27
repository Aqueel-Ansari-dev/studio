
'use server';

export interface TrainingMaterial {
  id: string;
  title: string;
  description: string;
  category: string;
  mediaUrl: string;
}

export async function getTrainingMaterials(): Promise<TrainingMaterial[]> {
  // Placeholder implementation; in a real app this would fetch from Firestore
  return [
    {
      id: '1',
      title: 'Safety Basics',
      description: 'Mandatory safety training for new employees.',
      category: 'safety',
      mediaUrl: '/training/safety-basics.mp4'
    },
    {
      id: '2',
      title: 'Equipment Usage',
      description: 'Guide to operating standard equipment.',
      category: 'equipment',
      mediaUrl: '/training/equipment-usage.pdf'
    }
  ];
}
