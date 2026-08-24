import { describe, expect, it } from 'vitest';
import { createLocalToolSetupState, localToolSetupStateForStage } from '../client/src/lib/localRemovalSetup';

describe('local removal setup status', () => {
  it('reports a complete, understandable ready state', () => {
    expect(createLocalToolSetupState('ready')).toMatchObject({ status: 'ready', progress: 100 });
    expect(createLocalToolSetupState('success')).toMatchObject({ status: 'success', progress: 100 });
  });

  it('moves setup progress forward with each local runtime stage', () => {
    expect(localToolSetupStateForStage('downloading').progress).toBeLessThan(localToolSetupStateForStage('loading').progress);
    expect(localToolSetupStateForStage('loading').progress).toBeLessThan(localToolSetupStateForStage('processing').progress);
    expect(localToolSetupStateForStage('processing').progress).toBeLessThan(localToolSetupStateForStage('finishing').progress);
  });
});
