import { PageContainer } from '@/layouts/components/page-container';
import { Applications } from './applications';
import { NextBanner } from './banner';
import { Datasets } from './datasets';
import { WorkspaceQuotas } from './workspace-quotas';

const Home = () => {
  return (
    <PageContainer>
      <article>
        <header className="mb-8">
          <NextBanner />
        </header>

        <WorkspaceQuotas />
        <Datasets />
        <Applications />
      </article>
    </PageContainer>
  );
};

export default Home;
