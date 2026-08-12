import { parseGuide } from './guide';

describe('parseGuide', () => {
  it('collects second- and third-level headings with nested anchors', () => {
    const guide = parseGuide(`## Workspaces {#workspace}

### Personal workspace

### Team workspace

## 模型配置 {#models}

### 推荐配置顺序`);

    expect(guide.headings).toEqual([
      { id: 'workspace', level: 2, title: 'Workspaces' },
      {
        id: 'workspace-personal-workspace',
        level: 3,
        title: 'Personal workspace',
      },
      {
        id: 'workspace-team-workspace',
        level: 3,
        title: 'Team workspace',
      },
      { id: 'models', level: 2, title: '模型配置' },
      { id: 'models-推荐配置顺序', level: 3, title: '推荐配置顺序' },
    ]);
    expect(guide.content).not.toContain('{#');
  });

  it('keeps generated anchors unique', () => {
    const guide = parseGuide(`## Section
### Details
### Details`);

    expect(guide.headings.map(({ id }) => id)).toEqual([
      'section',
      'section-details',
      'section-details-2',
    ]);
  });
});
