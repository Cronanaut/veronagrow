import PlantDiaryClient from '@/components/PlantDiaryClient';

type Props = {
  params: { id: string };
};

export default function PlantDiaryPage({ params }: Props) {
  const { id } = params;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Plant Diary</h1>
      <PlantDiaryClient plantBatchId={id} />
    </main>
  );
}