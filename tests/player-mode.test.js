import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  normalizePlayerSettings,
  resolvePlayerContainerOptions,
} from '../src/scripts/services/player-mode.js';

describe('player mode settings', () => {
  it('is off by default and offers the show-code button', () => {
    expect(normalizePlayerSettings(undefined)).toEqual({ playerMode: false, playerShowCodeButton: true });
    expect(normalizePlayerSettings({})).toEqual({ playerMode: false, playerShowCodeButton: true });
  });

  it('reads flat, nested and per-content settings', () => {
    expect(normalizePlayerSettings({ playerMode: true }).playerMode).toBe(true);
    expect(normalizePlayerSettings({ options: { playerMode: true, playerShowCodeButton: false } }))
      .toEqual({ playerMode: true, playerShowCodeButton: false });
  });

  it('resolves the assignment editor from editorSettings and inline parts from the content item', () => {
    const params = { editorSettings: { playerMode: true } };

    expect(resolvePlayerContainerOptions(params, null).playerMode).toBe(true);
    expect(resolvePlayerContainerOptions(params, { code: 'x' }).playerMode).toBe(false);
    expect(resolvePlayerContainerOptions(params, { options: { playerMode: true } }).playerMode).toBe(true);
  });
});

describe('CodeQuestionContainer player mode', () => {
  let CodeQuestionContainer;

  beforeEach(async () => {
    vi.resetModules();
    globalThis.H5P.CodeContainer = class CodeContainer {
      getUIRegistrations() {
        return { buttons: [], pages: [], observers: [] };
      }

      getContainerClasses() {
        return 'base';
      }

      hasStorageButtons() {
        return true;
      }

      hasFileManagerPage() {
        return true;
      }
    };
    globalThis.H5P.DialogQueue = class DialogQueue {};

    ({ default: CodeQuestionContainer } = await import('../src/scripts/container/codequestion-container.js'));
  });

  function createPlayer(options) {
    const instance = Object.create(CodeQuestionContainer.prototype);
    const containerDiv = document.createElement('div');
    const buttons = {
      setButtonVisibility: vi.fn(),
      getButton: vi.fn(() => null),
    };

    instance.options = options;
    instance.l10n = { playerShowCode: 'Show code', playerShowOutput: 'Output', showCode: 'Code' };
    instance.getContainerDiv = () => containerDiv;
    instance.getButtonManager = () => buttons;
    instance.showCodePage = vi.fn();
    instance.clearPendingEditorFocus = vi.fn();
    instance.resizeActionHandler = vi.fn();

    return { instance, containerDiv, buttons };
  }

  it('does not change a normal editor container', () => {
    const { instance } = createPlayer({});

    expect(instance.isPlayerMode()).toBe(false);
    expect(instance.isEditorHiddenByPlayer()).toBe(false);
    expect(instance.getContainerClasses()).toBe('base');
    expect(instance.hasStorageButtons()).toBe(true);
    expect(instance.hasFileManagerPage()).toBe(true);
    expect(instance.hasPlayerCodeToggle()).toBe(false);

    instance.setPlayerCodeVisible(true);
    expect(instance.showCodePage).not.toHaveBeenCalled();
  });

  it('adds the player class and drops save/load and file manager', () => {
    const { instance } = createPlayer({ playerMode: true });

    expect(instance.getContainerClasses()).toBe('base player-mode');
    expect(instance.hasStorageButtons()).toBe(false);
    expect(instance.hasFileManagerPage()).toBe(false);
    expect(instance.isEditorHiddenByPlayer()).toBe(true);
    expect(instance.shouldFocusEditor()).toBe(false);
  });

  it('only offers the toggle when the author allows it', () => {
    expect(createPlayer({ playerMode: true }).instance.hasPlayerCodeToggle()).toBe(true);
    expect(createPlayer({ playerMode: true, playerShowCodeButton: false }).instance.hasPlayerCodeToggle()).toBe(false);
  });

  it('reveals and hides the editor via the toggle buttons', () => {
    const { instance, containerDiv, buttons } = createPlayer({ playerMode: true });

    instance.showPlayerCode();
    expect(containerDiv.classList.contains('player-code-visible')).toBe(true);
    expect(buttons.setButtonVisibility).toHaveBeenCalledWith('playerShowCode', false);
    expect(buttons.setButtonVisibility).toHaveBeenCalledWith('playerHideCode', true);
    expect(instance.showCodePage).toHaveBeenCalledTimes(1);
    expect(instance.isEditorHiddenByPlayer()).toBe(false);

    instance.hidePlayerCode();
    expect(containerDiv.classList.contains('player-code-visible')).toBe(false);
    expect(buttons.setButtonVisibility).toHaveBeenCalledWith('playerShowCode', true);
    expect(instance.isEditorHiddenByPlayer()).toBe(true);
  });

  it('labels the back button "Output" while the editor is hidden', () => {
    const { instance, buttons } = createPlayer({ playerMode: true });
    const button = document.createElement('button');
    button.append('Code');
    buttons.getButton = vi.fn(() => button);

    instance.setPlayerCodeVisible(false);
    expect(button.textContent).toBe('Output');

    instance.setPlayerCodeVisible(true);
    expect(button.textContent).toBe('Code');
  });

  it('keeps Run reachable from the output page of a player', () => {
    const { instance, buttons } = createPlayer({ playerMode: true });
    const showButton = vi.fn();

    instance.getButtonManager = () => ({ ...buttons, hideButton: vi.fn(), showButton });
    instance.getStateManager = () => ({ isRunning: () => false });
    instance.onHideCodePage();
    expect(showButton).toHaveBeenCalledWith('runButton');

    showButton.mockClear();
    instance.getStateManager = () => ({ isRunning: () => true });
    instance.onHideCodePage();
    expect(showButton).not.toHaveBeenCalledWith('runButton');
  });

  it('does not jump into a hidden editor when the code cannot be revealed', () => {
    const { instance } = createPlayer({ playerMode: true, playerShowCodeButton: false });
    instance.lastExecutionError = { line: 3 };
    instance.getEditorManager = vi.fn();

    instance.focusErrorLine();

    expect(instance.showCodePage).not.toHaveBeenCalled();
    expect(instance.getEditorManager).not.toHaveBeenCalled();
  });
});
