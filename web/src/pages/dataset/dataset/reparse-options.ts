type ReparseOptionState = {
  chunkCount: number;
  isRunning?: boolean;
};

// Chunk count must not bypass the dialog: first parses need the same option to
// apply current knowledge-base settings as reparses. Stop actions still skip it.
export const shouldSkipReparseOptions = (state: ReparseOptionState) =>
  state.isRunning === true;
