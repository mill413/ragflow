import {
  createFilterOptions,
  matchesSelectedFilter,
} from '../table-filter-utils';

describe('admin table multi-filter helpers', () => {
  it('creates sorted unique options and ignores empty values', () => {
    const options = createFilterOptions(
      [
        { workspace: 'team-b' },
        { workspace: '' },
        { workspace: 'team-a' },
        { workspace: 'team-b' },
      ],
      (row) => row.workspace,
      (value) => `Workspace ${value}`,
    );

    expect(options).toEqual([
      { value: 'team-a', label: 'Workspace team-a' },
      { value: 'team-b', label: 'Workspace team-b' },
    ]);
  });

  it('uses OR within one filter and treats an empty selection as all rows', () => {
    expect(matchesSelectedFilter('team-a', [])).toBe(true);
    expect(matchesSelectedFilter('team-a', ['team-a', 'team-b'])).toBe(true);
    expect(matchesSelectedFilter('team-c', ['team-a', 'team-b'])).toBe(false);
  });
});
