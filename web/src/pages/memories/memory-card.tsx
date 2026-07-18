import { HomeCard } from '@/components/home-card';
import { MoreButton } from '@/components/more-button';
import { WorkspaceBadge } from '@/components/workspace-badge';
import { useNavigatePage } from '@/hooks/logic-hooks/navigate-hooks';
import { IMemory } from './interface';
import { MemoryDropdown } from './memory-dropdown';

interface IProps {
  data: IMemory;
  showMemoryRenameModal: (data: IMemory) => void;
}
export function MemoryCard({ data, showMemoryRenameModal }: IProps) {
  const { navigateToMemory } = useNavigatePage();

  return (
    <HomeCard
      data={{
        name: data?.name,
        avatar: data?.avatar,
        description: data?.description,
        update_time: data?.create_time,
      }}
      moreDropdown={
        data.capabilities?.update || data.capabilities?.delete ? (
          <MemoryDropdown
            memory={data}
            showMemoryRenameModal={showMemoryRenameModal}
          >
            <MoreButton></MoreButton>
          </MemoryDropdown>
        ) : undefined
      }
      sharedBadge={<WorkspaceBadge {...data} />}
      onClick={navigateToMemory(data?.id)}
    />
  );
}
