import { HomeCard } from '@/components/home-card';
import { MoreButton } from '@/components/more-button';
import { Card, CardContent } from '@/components/ui/card';
import { WorkspaceBadge } from '@/components/workspace-badge';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { IDataset } from '@/interfaces/database/dataset';
import { t } from 'i18next';
import { ChevronRight } from 'lucide-react';
import { DatasetDropdown } from './dataset-dropdown';
import { useRenameDataset } from './use-rename-dataset';

export type DatasetCardProps = {
  dataset: IDataset;
} & Pick<ReturnType<typeof useRenameDataset>, 'showDatasetRenameModal'>;

export function DatasetCard({
  dataset,
  showDatasetRenameModal,
}: DatasetCardProps) {
  const { navigateToDataset } = useNavigatePage();

  return (
    <HomeCard
      data={{
        ...dataset,
        description: `${dataset.document_count} ${t('knowledgeDetails.files')}`,
      }}
      moreDropdown={
        dataset.capabilities?.update || dataset.capabilities?.delete ? (
          <DatasetDropdown
            showDatasetRenameModal={showDatasetRenameModal}
            dataset={dataset}
          >
            <MoreButton></MoreButton>
          </DatasetDropdown>
        ) : undefined
      }
      sharedBadge={
        <WorkspaceBadge
          workspace_type={dataset.workspace_type}
          workspace_name={dataset.workspace_name || dataset.nickname}
          creator_name={dataset.creator_name || dataset.nickname}
        />
      }
      onClick={navigateToDataset(dataset.id)}
    />
  );
}

export function SeeAllCard() {
  const { navigateToDatasetList } = useNavigatePage();

  return (
    <Card
      className="w-full flex-none h-full cursor-pointer"
      onClick={() => navigateToDatasetList({ isCreate: false })}
    >
      <CardContent className="p-2.5 pt-1 w-full h-full flex items-center justify-center gap-1.5 text-text-secondary">
        {t('common.seeAll')} <ChevronRight className="size-4" />
      </CardContent>
    </Card>
  );
}
