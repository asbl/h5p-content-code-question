import { describe, expect, it, vi } from 'vitest';

import CodeQuestionStateService from '../src/scripts/services/codequestion-state.js';

describe('CodeQuestionStateService', () => {
  it('serializes only changed assignment and inline workspaces', () => {
    const service = new CodeQuestionStateService();
    const assignmentSnapshot = { files: [{ name: 'main.py', code: 'print(1)' }] };
    const inlineSnapshot = { files: [{ name: 'helper.py', code: 'value = 2' }] };
    const unchangedSnapshot = { files: [{ name: 'main.py', code: 'default' }] };

    const state = service.getState({
      assignmentContainer: {
        getWorkspaceSnapshot: () => assignmentSnapshot,
      },
      contentContainers: new Map([
        ['inline', { getWorkspaceSnapshot: () => inlineSnapshot }],
        ['unchanged', {
          getWorkspaceSnapshot: () => unchangedSnapshot,
          getDefaultWorkspaceSnapshot: () => unchangedSnapshot,
        }],
      ]),
    });

    expect(state).toEqual({
      assignmentState: { workspaceSnapshot: assignmentSnapshot },
      contentItemStates: {
        inline: { workspaceSnapshot: inlineSnapshot },
      },
    });
  });

  it('does not persist empty or unchanged workspaces and restores snapshots safely', () => {
    const service = new CodeQuestionStateService();
    const setWorkspaceSnapshot = vi.fn();
    const snapshot = { files: [{ name: 'main.py', code: 'restored' }] };

    expect(service.getState({
      assignmentContainer: { getWorkspaceSnapshot: () => ({ files: [] }) },
    })).toBeUndefined();

    service.applyContainerState({ setWorkspaceSnapshot }, { workspaceSnapshot: snapshot });
    service.applyContainerState(null, { workspaceSnapshot: snapshot });
    service.applyContainerState({ setWorkspaceSnapshot }, {});

    expect(setWorkspaceSnapshot).toHaveBeenCalledTimes(1);
    expect(setWorkspaceSnapshot).toHaveBeenCalledWith(snapshot);
  });
});
