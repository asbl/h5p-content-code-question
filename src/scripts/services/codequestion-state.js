/**
 * Handles persistence and restoration of CodeQuestion editor workspaces.
 *
 * Keeping this independent of H5P and the DOM makes the persisted-state
 * contract reusable by language-specific question types and directly testable.
 */
export default class CodeQuestionStateService {
  /**
   * Builds a persistable state entry from one code container.
   * @param {object} container - Code container.
   * @returns {object|null} Persistable state entry or null.
   */
  getContainerState(container) {
    const snapshot = container?.getWorkspaceSnapshot?.();
    const defaultSnapshot = container?.getDefaultWorkspaceSnapshot?.();

    if (!snapshot?.files?.length) {
      return null;
    }

    if (defaultSnapshot && JSON.stringify(snapshot) === JSON.stringify(defaultSnapshot)) {
      return null;
    }

    return { workspaceSnapshot: snapshot };
  }

  /**
   * Applies a persisted workspace entry to a code container.
   * @param {object} container - Code container.
   * @param {object} [state] - Persisted container state.
   * @returns {void}
   */
  applyContainerState(container, state = {}) {
    if (state?.workspaceSnapshot) {
      container?.setWorkspaceSnapshot?.(state.workspaceSnapshot);
    }
  }

  /**
   * Builds the H5P persistence object for assignment and inline editors.
   * @param {object} options - Workspace containers to serialize.
   * @param {object|null} [options.assignmentContainer] - Main assignment editor.
   * @param {Map<string, object>} [options.contentContainers] - Inline editor containers.
   * @returns {object|undefined} State object, or undefined when no changes exist.
   */
  getState({ assignmentContainer = null, contentContainers = new Map() } = {}) {
    const state = {};
    const assignmentState = this.getContainerState(assignmentContainer);
    const contentItemStates = {};

    if (assignmentState) {
      state.assignmentState = assignmentState;
    }

    contentContainers.forEach((container, containerId) => {
      const containerState = this.getContainerState(container);
      if (containerState) {
        contentItemStates[containerId] = containerState;
      }
    });

    if (Object.keys(contentItemStates).length > 0) {
      state.contentItemStates = contentItemStates;
    }

    return Object.keys(state).length > 0 ? state : undefined;
  }
}
