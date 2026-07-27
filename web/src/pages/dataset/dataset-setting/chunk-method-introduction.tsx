import { Card, CardContent } from '@/components/ui/card';
import CategoryPanel from './category-panel';

const ChunkMethodIntroduction = ({ parserId }: { parserId: string }) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Card as="article" className="flex-1 overflow-auto">
        <CardContent className="p-5">
          <CategoryPanel chunkMethod={parserId}></CategoryPanel>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChunkMethodIntroduction;
