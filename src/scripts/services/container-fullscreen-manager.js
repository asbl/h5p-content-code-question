import { getCodeQuestionL10nValue } from './codequestion-l10n';

/**
 * Handles fullscreen enter/exit and the collapsible task panel (shown in
 * fullscreen so instructions/test cases stay reachable) for a
 * CodeQuestionContainer. Kept independent of the rest of the container so
 * the H5P.fullScreen() wiring and its own DOM bookkeeping (task panel,
 * restore points) do not spill into the container's other concerns.
 */
export default class ContainerFullscreenManager {
  /**
   * @param {object} container Owning CodeQuestionContainer instance.
   */
  constructor(container) {
    this.container = container;
    this.taskPanel = null;
    this.taskPanelRestorePoints = [];
  }

  /**
   * Enters fullscreen and reveals the task panel, if entering succeeded.
   * @returns {void}
   */
  enableFullscreen() {
    if (this.setFullscreen()) {
      this.showTaskPanel();
    }
  }

  /**
   * Hides the task panel and exits fullscreen.
   * @returns {void}
   */
  disableFullscreen() {
    this.hideTaskPanel();
    this.unsetFullscreen();
  }

  /**
   * Lazily creates the collapsible task panel element.
   * @returns {{panel: HTMLElement, content: HTMLElement}} Task panel DOM refs.
   */
  ensureTaskPanel() {
    if (this.taskPanel) {
      return this.taskPanel;
    }

    const container = this.container;
    const panel = document.createElement('aside');
    panel.className = 'codequestion-task-panel';
    panel.setAttribute('aria-label', getCodeQuestionL10nValue(container.l10n, 'taskPanelLabel'));
    const header = document.createElement('div');
    header.className = 'codequestion-task-panel__header';
    const title = document.createElement('strong');
    title.textContent = getCodeQuestionL10nValue(container.l10n, 'taskPanelLabel');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'codequestion-task-panel__toggle';
    toggle.textContent = getCodeQuestionL10nValue(container.l10n, 'taskPanelCollapse');
    toggle.setAttribute('aria-expanded', 'true');
    const content = document.createElement('div');
    content.className = 'codequestion-task-panel__content';
    toggle.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('is-collapsed');
      content.hidden = collapsed;
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.textContent = getCodeQuestionL10nValue(container.l10n, collapsed ? 'taskPanelExpand' : 'taskPanelCollapse');
    });
    header.append(title, toggle);
    panel.append(header, content);
    container.getContainerDiv().append(panel);
    this.taskPanel = { panel, content };
    return this.taskPanel;
  }

  /**
   * Moves the instructions/test-case areas into the task panel and shows it.
   * @returns {void}
   */
  showTaskPanel() {
    const taskPanel = this.ensureTaskPanel();
    const questionRoot = this.container.parent.closest('.h5p-codequestion');
    const nodes = questionRoot
      ? [...questionRoot.querySelectorAll('.instructions-container, .testcases-area')]
      : [];

    this.taskPanelRestorePoints = nodes.map((node) => ({
      node,
      parent: node.parentNode,
      nextSibling: node.nextSibling,
    }));
    nodes.forEach((node) => taskPanel.content.append(node));
    taskPanel.panel.hidden = nodes.length === 0;
  }

  /**
   * Restores the instructions/test-case areas to their original position
   * and hides the task panel.
   * @returns {void}
   */
  hideTaskPanel() {
    this.taskPanelRestorePoints?.forEach(({ node, parent, nextSibling }) => {
      if (!parent) return;
      parent.insertBefore(node, nextSibling);
    });
    this.taskPanelRestorePoints = [];
    if (this.taskPanel) {
      this.taskPanel.panel.hidden = true;
    }
  }

  /**
   * Returns the DOM element that should receive fullscreen styling.
   * @returns {HTMLElement|null} Fullscreen host element.
   */
  getFullscreenHost() {
    const container = this.container;
    return container.containerDiv?.parentNode?.parentNode
      || container.parent?.closest?.('.content-part')
      || container.parent
      || null;
  }

  /**
   * Returns the surrounding H5P container element.
   * @returns {HTMLElement|null} H5P container element.
   */
  getH5PContainer() {
    const container = this.container;
    return container.parent?.closest?.('.h5p-container')
      || document?.querySelector?.('.h5p-container')
      || null;
  }

  /**
   * Resolves the H5P instance that owns the given container, used as the
   * target for H5P.fullScreen().
   * @param {HTMLElement|null} h5pContainer H5P container element.
   * @returns {object|null} H5P content instance.
   */
  getFullscreenInstance(h5pContainer) {
    const container = this.container;

    if (container.h5pInstance && typeof container.h5pInstance.trigger === 'function') {
      return container.h5pInstance;
    }

    const instances = Array.isArray(H5P?.instances) ? H5P.instances : [];

    return instances.find((instance) => {
      const candidateContainer = instance?.$container?.[0]
        || instance?.$container?.get?.(0)
        || instance?.container?.[0]
        || instance?.container
        || null;

      return candidateContainer === h5pContainer;
    }) || instances[0] || null;
  }

  /**
   * Enters fullscreen via H5P.fullScreen(), if all prerequisites resolve.
   * @returns {boolean} True if fullscreen was entered.
   */
  setFullscreen() {
    const container = this.container;
    const fullscreenHost = this.getFullscreenHost();
    const h5pContainer = this.getH5PContainer();
    const fullscreenInstance = this.getFullscreenInstance(h5pContainer);

    if (!fullscreenHost
      || !h5pContainer
      || !fullscreenInstance
      || typeof H5P?.fullScreen !== 'function'
      || typeof H5P?.jQuery !== 'function') {
      return false;
    }

    container.getButtonManager().hideButton('fullscreenEnable');
    container.getButtonManager().showButton('fullscreenDisable');
    container.getButtonManager().getButton?.('fullscreenDisable')?.setAttribute('aria-expanded', 'true');
    container.getButtonManager().getButton?.('fullscreenEnable')?.setAttribute('aria-expanded', 'true');
    container.fullscreen = true;
    fullscreenHost.classList.add('fullscreen', 'codequestion-fullscreen-host');
    fullscreenHost.classList.remove('theme-light', 'theme-dark');
    fullscreenHost.classList.add(container.getThemeClassName());

    h5pContainer?.classList.remove('theme-light', 'theme-dark');
    h5pContainer?.classList.add(container.getThemeClassName());

    H5P.fullScreen(H5P.jQuery(h5pContainer), fullscreenInstance);

    return true;
  }

  /**
   * Exits fullscreen and restores non-fullscreen button/theme state.
   * @param {object} [options] Exit options.
   * @param {boolean} [options.skipNativeExit] Skip calling H5P.exitFullScreen().
   * @returns {void}
   */
  unsetFullscreen(options = {}) {
    const container = this.container;
    const { skipNativeExit = false } = options;
    const fullscreenHost = this.getFullscreenHost();
    const h5pContainer = this.getH5PContainer();

    container.getButtonManager().hideButton('fullscreenDisable');
    container.getButtonManager().showButton('fullscreenEnable');
    container.getButtonManager().getButton?.('fullscreenDisable')?.setAttribute('aria-expanded', 'false');
    container.getButtonManager().getButton?.('fullscreenEnable')?.setAttribute('aria-expanded', 'false');
    container.fullscreen = false;
    fullscreenHost?.classList.remove('fullscreen', 'codequestion-fullscreen-host', 'theme-light', 'theme-dark');

    h5pContainer?.classList.remove('theme-light', 'theme-dark');

    container.getEditorManager().restoreDynamicHeight();
    container.getConsoleManager().restoreConsoleHeight();
    this.hideTaskPanel();

    if (!skipNativeExit && typeof H5P.exitFullScreen === 'function') {
      H5P.exitFullScreen();
    }
  }
}
