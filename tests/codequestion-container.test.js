import { beforeEach, describe, expect, it, vi } from 'vitest';

let CodeQuestionContainer;

describe('CodeQuestionContainer load workflow', () => {
  beforeEach(async () => {
    vi.resetModules();
    globalThis.H5P.CodeContainer = class CodeContainer {};
    globalThis.H5P.DialogQueue = class DialogQueue {
      enqueueAlert = vi.fn().mockResolvedValue(undefined);
    };

    ({ default: CodeQuestionContainer } = await import('../src/scripts/container/codequestion-container.js'));
  });

  it('returns to a clean code view after a successful load', async () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const loadFile = vi.fn().mockResolvedValue('print(1)');
    const removeCanvas = vi.fn();

    instance.getStorageManager = vi.fn(() => ({ loadFile }));
    instance.stop = vi.fn();
    instance.reset = vi.fn();
    instance.showCodePage = vi.fn();
    instance.hideStopButton = vi.fn();
    instance.showRunButton = vi.fn();
    instance.updateCanvasButton = vi.fn();
    instance.getCanvasManager = vi.fn(() => ({ removeCanvas }));

    await expect(instance.load()).resolves.toBe(true);

    expect(loadFile).toHaveBeenCalledTimes(1);
    expect(instance.stop).toHaveBeenCalledTimes(1);
    expect(instance.reset).toHaveBeenCalledTimes(1);
    expect(removeCanvas).toHaveBeenCalledTimes(1);
    expect(instance.showCodePage).toHaveBeenCalledTimes(1);
    expect(instance.hideStopButton).toHaveBeenCalledTimes(1);
    expect(instance.showRunButton).toHaveBeenCalledTimes(1);
    expect(instance.updateCanvasButton).toHaveBeenCalledTimes(1);
  });

  it('closes the file manager state when returning to the code page', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const closeFileManager = vi.fn();
    const showPage = vi.fn();
    const showButton = vi.fn();
    const hideButton = vi.fn();
    const setActive = vi.fn();

    instance.getEditorManager = vi.fn(() => ({ closeFileManager }));
    instance.getPageManager = vi.fn(() => ({ showPage }));
    instance.getStateManager = vi.fn(() => ({ isRunning: () => false }));
    instance.getButtonManager = vi.fn(() => ({ showButton, hideButton, setActive }));
    instance.registerDOM = vi.fn();

    instance.showCodePage();

    expect(closeFileManager).toHaveBeenCalledWith({ skipPageChange: true });
    expect(showPage).toHaveBeenCalledWith('code');
    expect(showButton).toHaveBeenCalledWith('runButton');
    expect(setActive).toHaveBeenCalledWith('runButton');
    expect(hideButton).toHaveBeenCalledWith('showCodeButton');
    expect(instance.registerDOM).toHaveBeenCalledTimes(1);
  });

  it('does nothing when loading is cancelled', async () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const loadFile = vi.fn().mockResolvedValue(null);

    instance.getStorageManager = vi.fn(() => ({ loadFile }));
    instance.stop = vi.fn();
    instance.reset = vi.fn();
    instance.showCodePage = vi.fn();
    instance.hideStopButton = vi.fn();
    instance.showRunButton = vi.fn();

    await expect(instance.load()).resolves.toBe(false);

    expect(instance.stop).not.toHaveBeenCalled();
    expect(instance.reset).not.toHaveBeenCalled();
    expect(instance.showCodePage).not.toHaveBeenCalled();
  });

  it('shows a localized dialog when loading fails', async () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const error = Object.assign(new Error('invalid bundle'), { code: 'load_invalid_project_bundle' });
    const loadFile = vi.fn().mockRejectedValue(error);
    const dialogQueue = { enqueueAlert: vi.fn().mockResolvedValue(undefined) };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    instance.l10n = {
      loadFailedTitle: 'Load failed',
      loadInvalidProjectBundle: 'Invalid project bundle',
      loadUnsupportedFileType: 'Unsupported file type',
      loadReadError: 'Read failed',
      loadFailedMessage: 'Generic load failure',
    };
    instance.getStorageManager = vi.fn(() => ({ loadFile }));
    instance.getDialogQueue = vi.fn(() => dialogQueue);
    instance.stop = vi.fn();
    instance.reset = vi.fn();
    instance.showCodePage = vi.fn();
    instance.hideStopButton = vi.fn();
    instance.showRunButton = vi.fn();

    await expect(instance.load()).resolves.toBe(false);

    expect(dialogQueue.enqueueAlert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Load failed',
      text: 'Invalid project bundle',
      showCancelButton: false,
    }));
    expect(consoleError).toHaveBeenCalled();
    expect(instance.stop).not.toHaveBeenCalled();
  });

  it('stops runtime state and returns to code page on stop', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const runtimeStop = vi.fn();
    const stateStop = vi.fn();
    const showCodePage = vi.fn();

    instance._runtime = { stop: runtimeStop };
    instance.getStateManager = vi.fn(() => ({ stop: stateStop }));
    instance.showCodePage = showCodePage;

    instance.stop();

    expect(runtimeStop).toHaveBeenCalledTimes(1);
    expect(stateStop).toHaveBeenCalledTimes(1);
    expect(showCodePage).toHaveBeenCalledTimes(1);
  });

  it('still resets state and shows code page when runtime is missing', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const stateStop = vi.fn();
    const showCodePage = vi.fn();

    instance.getStateManager = vi.fn(() => ({ stop: stateStop }));
    instance.showCodePage = showCodePage;

    instance.stop();

    expect(stateStop).toHaveBeenCalledTimes(1);
    expect(showCodePage).toHaveBeenCalledTimes(1);
  });

  it('uses the current h5pInstance for fullscreen instead of the first global instance', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const h5pContainer = document.createElement('div');
    h5pContainer.className = 'h5p-container';
    const fullscreenHost = document.createElement('div');
    const parent = document.createElement('div');
    const containerDiv = document.createElement('div');
    parent.appendChild(containerDiv);
    fullscreenHost.appendChild(parent);
    h5pContainer.appendChild(fullscreenHost);

    const targetInstance = { id: 'target' };
    const wrongInstance = { id: 'wrong' };
    const hideButton = vi.fn();
    const showButton = vi.fn();

    Object.assign(instance, {
      parent,
      containerDiv,
      h5pInstance: targetInstance,
      fullscreen: false,
      getThemeClassName: () => 'theme-dark',
      getButtonManager: () => ({ hideButton, showButton }),
    });

    H5P.jQuery = vi.fn((element) => ({ element }));
    H5P.fullScreen = vi.fn();
    H5P.instances = [wrongInstance];

    const result = instance.setFullscreen();

    expect(result).toBe(true);
    expect(H5P.fullScreen).toHaveBeenCalledWith(H5P.jQuery(h5pContainer), targetInstance);
    expect(hideButton).toHaveBeenCalledWith('fullscreenEnable');
    expect(showButton).toHaveBeenCalledWith('fullscreenDisable');
    expect(instance.fullscreen).toBe(true);
    expect(fullscreenHost.classList.contains('fullscreen')).toBe(true);
  });

  it('resolves the fullscreen instance from H5P.instances when no explicit h5pInstance is set', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const h5pContainer = document.createElement('div');
    h5pContainer.className = 'h5p-container';
    const fullscreenHost = document.createElement('div');
    const parent = document.createElement('div');
    const containerDiv = document.createElement('div');
    parent.appendChild(containerDiv);
    fullscreenHost.appendChild(parent);
    h5pContainer.appendChild(fullscreenHost);

    const matchedInstance = { $container: [h5pContainer] };
    const otherContainer = document.createElement('div');
    const wrongInstance = { $container: [otherContainer] };

    Object.assign(instance, {
      parent,
      containerDiv,
      fullscreen: false,
      getThemeClassName: () => 'theme-dark',
      getButtonManager: () => ({ hideButton: vi.fn(), showButton: vi.fn() }),
    });

    H5P.jQuery = vi.fn((element) => ({ element }));
    H5P.fullScreen = vi.fn();
    H5P.instances = [wrongInstance, matchedInstance];

    const result = instance.setFullscreen();

    expect(result).toBe(true);
    expect(H5P.fullScreen).toHaveBeenCalledWith(H5P.jQuery(h5pContainer), matchedInstance);
  });

  it('aborts fullscreen gracefully when no local h5p container can be resolved', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const fullscreenHost = document.createElement('div');
    const parent = document.createElement('div');
    const containerDiv = document.createElement('div');
    parent.appendChild(containerDiv);
    fullscreenHost.appendChild(parent);

    const hideButton = vi.fn();
    const showButton = vi.fn();

    Object.assign(instance, {
      parent,
      containerDiv,
      h5pInstance: { id: 'target' },
      fullscreen: false,
      getThemeClassName: () => 'theme-dark',
      getButtonManager: () => ({ hideButton, showButton }),
    });

    H5P.jQuery = vi.fn((element) => ({ element }));
    H5P.fullScreen = vi.fn();
    H5P.instances = [{ id: 'wrong' }];

    const result = instance.setFullscreen();

    expect(result).toBe(false);
    expect(H5P.fullScreen).not.toHaveBeenCalled();
    expect(hideButton).not.toHaveBeenCalled();
    expect(showButton).not.toHaveBeenCalled();
    expect(instance.fullscreen).toBe(false);
  });

  it('unsets fullscreen without throwing when the host/container is missing', () => {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const hideButton = vi.fn();
    const showButton = vi.fn();
    const restoreDynamicHeight = vi.fn();
    const restoreConsoleHeight = vi.fn();

    Object.assign(instance, {
      parent: document.createElement('div'),
      containerDiv: document.createElement('div'),
      fullscreen: true,
      getButtonManager: () => ({ hideButton, showButton }),
      getEditorManager: () => ({ restoreDynamicHeight }),
      getConsoleManager: () => ({ restoreConsoleHeight }),
    });

    H5P.exitFullScreen = vi.fn();

    expect(() => instance.unsetFullscreen()).not.toThrow();
    expect(H5P.exitFullScreen).toHaveBeenCalledTimes(1);
    expect(hideButton).toHaveBeenCalledWith('fullscreenDisable');
    expect(showButton).toHaveBeenCalledWith('fullscreenEnable');
    expect(restoreDynamicHeight).toHaveBeenCalledTimes(1);
    expect(restoreConsoleHeight).toHaveBeenCalledTimes(1);
  });
});