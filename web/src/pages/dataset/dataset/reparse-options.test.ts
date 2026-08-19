import { shouldSkipReparseOptions } from './reparse-options';

describe('shouldSkipReparseOptions', () => {
  it('shows options when a document has no chunks yet', () => {
    expect(shouldSkipReparseOptions({ chunkCount: 0 })).toBe(false);
  });

  it('shows options when reparsing existing chunks', () => {
    expect(shouldSkipReparseOptions({ chunkCount: 10 })).toBe(false);
  });

  it('skips options when the action stops a running parse', () => {
    expect(shouldSkipReparseOptions({ chunkCount: 0, isRunning: true })).toBe(
      true,
    );
  });
});
