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
});