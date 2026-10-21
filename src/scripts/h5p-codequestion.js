import Util from './services/util';
import {
  createCodeQuestionL10n,
  getCodeQuestionL10nValue,
} from './services/codequestion-l10n';
import ManualRuntimeFactory from './runtime/factory-runtime-manual';
import ContainerFactory from './container/factory-container';
import CodeTesterFactory from './tester/factory-tester';
import TestRuntimeFactory from './runtime/factory-runtime-test';
import { Runtime } from './runtime/runtime';
import CodeQuestionContainer from './container/codequestion-container';
import CodeQuestionStateService from './services/codequestion-state';
import MultipleChoiceMode from './modes/multiple-choice-mode';
import SortItemsMode from './modes/sort-items-mode';
import ParsonsMode from './modes/parsons-mode';
import HintCascade from './services/hint-cascade';
import XAPIReporter from './services/xapi-reporter';
import InternalFrameResizeSync from './services/internal-frame-resize-sync';
import ContentPartRenderer from './services/content-part-renderer';

/**
 * @class
 * CodeQuestion – H5P question type for coding exercises.
 * Handles rendering, editor, runtime, test cases, scoring and xAPI events.
 */
export default class CodeQuestion extends H5P.Question {
  /* ------------------------------------------------------------------ *
   *  Constructor & basic initialisation
   * ------------------------------------------------------------------ */
  constructor(params = {}, contentId, extras = {}) {
    super('code-question', {});

    // ---- Safe defaults -------------------------------------------------
    params = Util.extend(
      {
        l10n: {},
        contents: [],
        editorSettings: {},
        gradingSettings: {},
        behaviour: {
          enableSolutionsButton: true,
          enableRetry: true,
          enableCheckButton: true,
          confirmCheckDialog: false,
          confirmRetryDialog: false,
          autoCheck: false,
        },
        contentType: 'text_and_ide',
      },
      params,
    );

    this.params = params;
    this.contentId = contentId;
    this.extras = extras;
    this.contentL10n = params.l10n || {};
    this.l10n = createCodeQuestionL10n(this.contentL10n);
    this.params.l10n = this.contentL10n;

    this.score = 0;
    this.answerGiven = false;
    this.passed = false;
    this.maxScore = 2;

    this.parentDiv = document.createElement('div');
    this.contents = params.contents;

    // ---- Editor defaults -----------------------------------------------
    this.defaultCode = params.editorSettings.startingCode || '';
    this.codeContainer = null;

    this.contentType = params.contentType || 'text_and_ide';
    this.instructions = params.editorSettings.instructions || null;
    this.instructionsImage = params.editorSettings.instructionsImage || null;
    this.preCode = params.editorSettings.preCode || null;
    this.postCode = params.editorSettings.postCode || null;

    // ---- Grading defaults -----------------------------------------------
    const gradingMethod = params.gradingSettings?.gradingMethod;
    this.gradingMethod =
      gradingMethod
      && gradingMethod !== 'none'
      && gradingMethod !== 'please_choose'
        ? gradingMethod
        : null;

    if (
      this.contentType === 'text_only'
      && this.gradingMethod !== 'multipleChoice'
      && this.gradingMethod !== 'sortItems'
      && this.gradingMethod !== 'parsons'
    ) {
      this.gradingMethod = null;
    }

    this.testcases = params.gradingSettings.testCases || [];
    this.multipleChoiceMode = new MultipleChoiceMode(
      this,
      params.gradingSettings?.multipleChoice || {},
      extras?.previousState?.selectedChoices,
    );
    this.answerGiven = this.multipleChoiceMode.selectedChoices.size > 0;

    // ---- Drag & drop sort question defaults -----------------------------
    this.sortItemsMode = new SortItemsMode(
      this,
      params.gradingSettings?.sortItems || {},
      extras?.previousState?.sortOrder,
    );
    if (this.isSortQuestion() && Array.isArray(extras?.previousState?.sortOrder) && extras.previousState.sortOrder.length > 0) {
      this.answerGiven = true;
    }

    // ---- Parsons problem defaults -----------------------------------------
    this.parsonsMode = new ParsonsMode(
      this,
      params.gradingSettings?.parsons || {},
      extras?.previousState?.parsonsOrder,
    );
    if (this.isParsonsQuestion() && Array.isArray(extras?.previousState?.parsonsOrder) && extras.previousState.parsonsOrder.length > 0) {
      this.answerGiven = true;
    }

    // ---- Didactic hint cascade --------------------------------------------
    this.hintCascade = new HintCascade(
      this,
      params.hintSettings || {},
      extras?.previousState || {},
    );

    // ---- Worked example after repeated failed checks -----------------------
    this.workedExampleSettings = this.normalizeWorkedExampleSettings(params.workedExampleSettings);
    this.failedChecks = Number.isInteger(extras?.previousState?.failedChecks)
      ? extras.previousState.failedChecks
      : 0;
    this.workedExampleRevealed = extras?.previousState?.workedExampleRevealed === true;

    /* Legacy handling:
    solutionCode can be handled in
     * params.gradingSettings.targetCode
     * or
     */
    this.solutionCode = params.gradingSettings.targetCode || null;
    if (!this.solutionCode) {
      this.solutionCode = params.gradingSettings.solution;
    }
    this.dueDate = params.gradingSettings?.dueDateGroup?.duedate || null;
    this.enableDueDate = params.gradingSettings?.dueDateGroup?.enableDueDate === true;

    this.codeTester = this.gradingMethod
      && !this.isMultipleChoiceQuestion()
      && !this.isSortQuestion()
      && !this.isParsonsQuestion()
      ? this.getCodeTesterFactory().create()
      : null;

    // If grading method is unsupported, disable grading safely.
    if (
      this.gradingMethod
      && !this.isMultipleChoiceQuestion()
      && !this.isSortQuestion()
      && !this.isParsonsQuestion()
      && !this.codeTester
    ) {
      this.gradingMethod = null;
    }

    this.maxScore = (this.isMultipleChoiceQuestion() || this.isSortQuestion() || this.isParsonsQuestion()) ? 1 : 2;

    // ---- UI flags -------------------------------------------------------
    this.hasConsole = params.editorSettings?.showConsole !== false;
    // "Check answer" evaluates the test cases and only makes sense once
    // grading is configured; without it, clicking it would be a no-op.
    // "Run" executes interactively (real input() prompts, real canvas)
    // against whatever the editor currently contains instead of the test
    // cases' input values, which is confusing side by side with "Check
    // answer" once grading exists. So exactly one of the two is shown,
    // based on whether test cases/grading are configured for this content.
    this.hasCheckButton = Boolean(this.codeTester)
      || this.isMultipleChoiceQuestion()
      || this.isSortQuestion()
      || this.isParsonsQuestion();
    this.hasRunButton = !this.codeTester
      && !this.isMultipleChoiceQuestion()
      && !this.isSortQuestion()
      && !this.isParsonsQuestion();
    this.hasStopButton = true;
    this.hasTestCaseArea = true;
    this.hasAssets = false;

    // ---- Unique IDs -----------------------------------------------------
    this.assetsAreaUID = `h5p_assets_area_${H5P.createUUID()}`;
    this.codeQuestionUID = `h5p_code_question_${H5P.createUUID()}`;

    this.xAPIlastEvent = null;
    this.xapiReporter = new XAPIReporter(this);

    this.codeContainers = new Map();
    this.stateService = new CodeQuestionStateService();
    this.frameResizeSync = new InternalFrameResizeSync(this);
    this.contentPartRenderer = new ContentPartRenderer(this);
  }

  getCodingLanguage() {
    return 'pseudocode';
  }

  isMultipleChoiceQuestion() {
    return this.gradingMethod === 'multipleChoice';
  }

  isSortQuestion() {
    return this.gradingMethod === 'sortItems';
  }

  isParsonsQuestion() {
    return this.gradingMethod === 'parsons';
  }

  /**
   * Normalizes the worked example settings authored for this content.
   * @param {object} rawSettings Raw workedExampleSettings params.
   * @returns {object} Normalized settings with enable, code and threshold.
   */
  normalizeWorkedExampleSettings(rawSettings = {}) {
    const rawThreshold = Number(rawSettings?.revealAfterFailedChecks);
    const threshold = Number.isInteger(rawThreshold) && rawThreshold > 0
      ? rawThreshold
      : 3;

    return {
      enable: rawSettings?.enable === true,
      code: typeof rawSettings?.code === 'string' ? rawSettings.code : '',
      revealAfterFailedChecks: threshold,
    };
  }

  /**
   * Returns the answer choices in display order.
   * @returns {Array<object>} Choices, shuffled when configured.
   */
  getDisplayedChoices() {
    return this.multipleChoiceMode.getDisplayedChoices();
  }

  isInternalFrame() {
    return window.H5P?.isFramed && window.H5P?.externalEmbed === false;
  }

  trigger(event, eventData, extras) {
    const eventType = (typeof event === 'string') ? event : event?.type;

    if (eventType === 'resize' && this.suppressInternalFrameResizeEvents && this.isInternalFrame()) {
      return;
    }

    return super.trigger(event, eventData, extras);
  }

  resizeActionHandler() {
    this.trigger('resize');
  }

  /**
   * Writes the current document height onto the host iframe element.
   * @returns {void}
   */
  syncFramedHeightFallback() {
    this.frameResizeSync.syncFramedHeightFallback();
  }

  /**
   * Schedules iframe-height resyncs after an evaluation changed the
   * visible content.
   * @returns {void}
   */
  scheduleEvaluationFrameSync() {
    this.frameResizeSync.scheduleEvaluationFrameSync();
  }

  /**
   * Schedules iframe-height resyncs after the page's own layout changed.
   * @returns {void}
   */
  scheduleInternalFrameLayoutSync() {
    this.frameResizeSync.scheduleInternalFrameLayoutSync();
  }

  /**
   * Removes the window resize listener and ResizeObserver, if installed.
   * @returns {void}
   */
  teardownInternalFrameResizeSync() {
    this.frameResizeSync.teardownInternalFrameResizeSync();
  }

  /**
   * Installs the window resize listener/ResizeObserver for internal-frame embeds.
   * @returns {void}
   */
  setupInternalFrameResizeSync() {
    this.frameResizeSync.setupInternalFrameResizeSync();
  }

  codeHandler() {
    this.codeContainer.getEditorManager().getCode();
  }


  /**
   * Builds the result object for answered/completed statements.
   * Returns a fully populated statement-result object.
   * Used by sendAnsweredEvent, sendCompletedEvent, and getXAPIData.
   * @returns {object} xAPI result object
   */
  buildResultStatement() {
    return this.xapiReporter.buildResultStatement();
  }

  /**
   * Returns the learner's response in xAPI's own interaction-type format.
   * @returns {string} Serialized response.
   */
  getResponse() {
    return this.xapiReporter.getResponse();
  }

  /**
   * Returns the localized feedback text for the current result state.
   * @returns {string} Localized success or failure text.
   */
  getFeedbackText() {
    return this.success()
      ? getCodeQuestionL10nValue(this.l10n, 'successText')
      : getCodeQuestionL10nValue(this.l10n, 'failedText');
  }

  /**
   * Returns the localized score label used in question feedback.
   * @returns {string} Localized score label.
   */
  getScoreLabel() {
    return getCodeQuestionL10nValue(this.l10n, 'score');
  }

  /**
   * Applies the current evaluation feedback to the question UI.
   * @param {number} [score] - Score to display.
   * @param {number} [maxScore] - Maximum score to display.
   * @returns {void}
   */
  applyScoreFeedback(score = this.getScore(), maxScore = this.getMaxScore()) {
    this.setFeedback(
      this.getFeedbackText(),
      score,
      maxScore,
      this.getScoreLabel(),
    );
  }

  /**
   * Sends an xAPI "attempted" statement.
   * Moodle interprets this event as the start of a new attempt.
   * @returns {void}
   */
  sendAttemptedEvent() {
    this.xapiReporter.sendAttemptedEvent();
  }

  /**
   * Sends an xAPI "answered" statement.
   * Represents the learner's response and score.
   * @returns {void}
   */
  sendAnsweredEvent() {
    this.xapiReporter.sendAnsweredEvent();
  }

  /**
   * Sends an xAPI "completed" statement.
   * Marks the end of the attempt.
   * @returns {void}
   */
  sendCompletedEvent() {
    this.xapiReporter.sendCompletedEvent();
  }

  /**
   * Returns xAPI statement data for answered events.
   * Used by Moodle reporting without sending an event.
   * @returns {object} xAPI statement object
   */
  getXAPIData() {
    return this.xapiReporter.getXAPIData();
  }

  /**
   * Creates a base xAPI event with all mandatory fields
   * shared between attempted, answered, and completed statements.
   *
   * Does NOT include result/score; used for building statements consistently.
   * @param {string} verb - The xAPI verb ("attempted", "answered", "completed")
   * @returns {H5P.XAPIEvent} A fully initialized H5P.XAPIEvent
   */
  createBaseXAPIEvent(verb) {
    return this.xapiReporter.createBaseXAPIEvent(verb);
  }

  /**
   * Returns the xAPI activity definition for this CodeQuestion.
   * This defines the "object" part of xAPI statements (name, description, type, interaction).
   * @returns {object} xAPI activity definition object
   */
  getxAPIDefinition() {
    return this.xapiReporter.getxAPIDefinition();
  }

  /**
   * Returns the xAPI interaction type for this CodeQuestion's current mode.
   * @returns {string} xAPI interaction type.
   */
  getxAPIInteractionType() {
    return this.xapiReporter.getxAPIInteractionType();
  }

  /**
   * Returns the xAPI correct-responses-pattern for this CodeQuestion's current mode.
   * @returns {string[]} Correct-responses pattern entries.
   */
  getCorrectResponsesPattern() {
    return this.xapiReporter.getCorrectResponsesPattern();
  }


  runAction() {
    this.resetStopSignal();
    this.removeFeedback();
    this.codeTester?.reset?.();
    this.codeContainer.run();
  }

  /**
   * Called when the user clicks the “Check” button.
   * It now sends an “attempted” event first, then the normal “answered”
   * event after the test run.
   */
  async checkAction() {
    if (
      this.isMultipleChoiceQuestion()
      || this.isSortQuestion()
      || this.isParsonsQuestion()
    ) {
      this.sendAttemptedEvent();
      this.sendAnsweredEvent();
      this.evaluate();
      return;
    }

    if (!this.codeTester) {
      return;
    }

    this.resetStopSignal();
    // Clear any stale execution-error banner (e.g. "Program could not be
    // run.") left over from an earlier manual run/attempt. Without this,
    // an old crash banner from a previous, since-fixed attempt keeps
    // showing during and after a fresh, successful automated test run,
    // making a correct submission look like it crashed.
    this.codeContainer?.dismissExecutionError?.();
    this.setCheckAnswerBusyState(true);

    try {
      // Start a new attempt
      this.sendAttemptedEvent();

      // Run tests
      this.codeTester.reset();
      const runtime = this.getTestRuntimeFactory().create();
      await runtime.start(this.codeContainer);

      // Show feedback
      const score = this.getScore();
      const maxScore = this.getMaxScore();
      this.applyScoreFeedback(score, maxScore);
      this.showRetryAfterCheck();
      // Send answered statement
      this.sendAnsweredEvent();

      this.scheduleEvaluationFrameSync();
    }
    finally {
      this.setCheckAnswerBusyState(false);
    }
  }

  /**
   * Looks up an H5P.Question button element. The buttons live in the
   * question's button bar, a sibling of the content, so they are searched
   * from the surrounding .h5p-question root.
   * @param {string} id Button id as passed to addButton().
   * @returns {HTMLElement|null} Button element, if rendered.
   */
  getQuestionButton(id) {
    const root = this.parentDiv?.closest?.('.h5p-question') || this.getContainer();
    return root?.querySelector?.(`.h5p-question-${id}`) || null;
  }

  getCheckAnswerButton() {
    return this.getQuestionButton('check-answer');
  }

  setCheckAnswerBusyState(isBusy) {
    this.isCheckingAnswer = isBusy;

    // Resetting while tests run would grade and report code the learner
    // has already discarded.
    const resetButton = this.getQuestionButton('reset-task');
    if (resetButton) {
      resetButton.disabled = isBusy;
    }

    const button = this.getCheckAnswerButton();
    if (!button) {
      return;
    }

    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.textContent || this.l10n.checkAnswer;
    }

    button.disabled = isBusy;
    button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    button.classList.toggle('is-busy', isBusy);
    button.textContent = isBusy
      ? getCodeQuestionL10nValue(this.l10n, 'checkingAnswer')
      : button.dataset.originalLabel;
  }

  /**
   * Final evaluation – creates a “completed” event.
   */
  evaluate() {
    const score = this.getScore();
    const maxScore = this.getMaxScore();

    this.answerGiven = true;

    this.applyScoreFeedback(score, maxScore);

    if (this.isMultipleChoiceQuestion()) {
      this.multipleChoiceMode.applyFeedback();
      this.multipleChoiceMode.setLocked(true);
    }

    if (this.isSortQuestion()) {
      this.applySortFeedback();
      this.setSortLocked(true);
    }

    if (this.isParsonsQuestion()) {
      this.parsonsMode.applyFeedback();
      this.parsonsMode.setLocked(true);
    }

    if (!this.success() && !this.isMultipleChoiceQuestion() && !this.isSortQuestion() && !this.isParsonsQuestion()) {
      this.trackFailedCheck();
    }

    this.showRetryAfterCheck();

    // Finalize attempt
    this.sendCompletedEvent();

    this.scheduleEvaluationFrameSync();
  }

  /**
   * Counts one failed check and reveals the authored worked example once the
   * configured number of failed checks is reached. Didactic rationale: after
   * repeated unsuccessful attempts, studying a fully worked solution with
   * comments is more productive than another unguided trial.
   * @returns {void}
   */
  trackFailedCheck() {
    this.failedChecks += 1;

    if (
      !this.workedExampleRevealed
      && this.workedExampleSettings.enable
      && this.workedExampleSettings.code.trim() !== ''
      && this.failedChecks >= this.workedExampleSettings.revealAfterFailedChecks
    ) {
      this.revealWorkedExample();
    }
  }

  /**
   * Indicates whether the worked example applies to this content.
   * @returns {boolean} True when a worked example is authored and enabled.
   */
  hasWorkedExample() {
    return this.workedExampleSettings.enable === true
      && this.workedExampleSettings.code.trim() !== '';
  }

  /**
   * Renders the worked example panel and marks it as revealed so it stays
   * visible across retries and page reloads.
   * @returns {void}
   */
  revealWorkedExample() {
    if (this.workedExampleRevealed || !this.hasWorkedExample()) {
      return;
    }

    this.workedExampleRevealed = true;

    const panel = this.buildWorkedExamplePanel();
    if (panel) {
      this.parentDiv.append(panel);
      this.resizeActionHandler();
    }
  }

  /**
   * Builds the collapsible worked example panel with the solution code.
   * @returns {HTMLElement|null} Panel element or null when disabled.
   */
  buildWorkedExamplePanel() {
    if (!this.hasWorkedExample()) {
      return null;
    }

    const details = document.createElement('details');
    details.className = 'codequestion-worked-example';
    const summary = document.createElement('summary');
    summary.textContent = getCodeQuestionL10nValue(this.l10n, 'workedExampleTitle');
    const intro = document.createElement('p');
    intro.className = 'codequestion-worked-example__intro';
    intro.textContent = getCodeQuestionL10nValue(this.l10n, 'workedExampleIntro');
    const body = document.createElement('div');
    const md = '```' + this.getCodingLanguage() + '\n' +
      this.getDecodedCode(this.workedExampleSettings.code) + '\n```';
    const markdown = new H5P.Markdown(md, this.getMarkdownOptions());
    this.appendResolvedMarkdown(body, markdown);
    details.append(summary, intro, body);

    return details;
  }


  getContainerClass() {
    return CodeQuestionContainer;
  }


  getContainerFactoryClass() {
    return ContainerFactory;
  }

  getContainerFactory(parent, code, isAssignmentContainer, contentParams = null) {
    const runtimeFactory = this.getManualRuntimeFactory();
    const FactoryClass = this.getContainerFactoryClass();

    return new FactoryClass(
      this.getContainerClass(),
      parent,
      this.getDecodedCode(code),
      isAssignmentContainer,
      this.preCode,
      this.postCode,
      this.getCodingLanguage(),
      this.hasConsole,
      this.l10n,
      this.instructions,
      this.instructionsImage,
      this.contentId,
      () => this.resizeActionHandler(),
      runtimeFactory,
      this,
      this.getCodeContainerOptions(contentParams)
    );
  }

  /**
   * Returns shared container options for the code container.
   * @param {object|null} [contentParams] Optional inline content item params.
   * @returns {object|Array<*>} Container options.
   */
  getCodeContainerOptions(contentParams = null) { // eslint-disable-line no-unused-vars
    return {
      hasConsole: this.hasConsole,
      enableDiagnosticLogs: this.params.advancedOptions?.enableDiagnosticLogs === true
        || this.params.behaviour?.enableDiagnosticLogs === true,
      // A web-IDE should preserve local work between reloads. This remains
      // browser-local and never replaces an LMS/H5P submission.
      workspaceAutosaveEnabled: this.contentType === 'ide_only' && contentParams === null,
      workspaceAutosaveKey: `h5p-codequestion:${this.contentId}:${this.getCodingLanguage()}`,
    };
  }

  getCodeTesterFactoryClass() {
    return CodeTesterFactory;
  }

  getCodeTesterFactory() {
    const FactoryClass = this.getCodeTesterFactoryClass();
    return new FactoryClass(
      this.testcases,
      this.gradingMethod,
      () => this.evaluate(),
      () => this.getTestRuntimeFactory(),
      this.l10n,
      this.dueDate,
      this.enableDueDate,
      this.getDecodedCode(this.solutionCode),
      this.params.gradingSettings?.functionName || '',
      this.params.gradingSettings?.algorithmConstraints || {},
      this.params.gradingSettings?.algorithmTrace || {},
      this.getCodeContainerOptions()?.enableDiagnosticLogs === true,
    );
  }

  getTestRuntimeFactoryClass() {
    return TestRuntimeFactory;
  }

  getTestRuntimeClass() {
    return Runtime;
  }

  getTestRuntimeFactory() {
    const FactoryClass = this.getTestRuntimeFactoryClass();
    return new FactoryClass(
      this.getTestRuntimeClass(),
      () => this.resizeActionHandler(),
      this.getDecodedCode(this.solutionCode),
      this.codeTester,
      this.getRuntimeOptions()
    );
  }

  getRuntimeOptions() {
    return {
      l10n: this.contentL10n,
      enableDiagnosticLogs: this.getCodeContainerOptions()?.enableDiagnosticLogs === true,
    };
  }

  getManualRuntimeClass() {
    return Runtime;
  }

  getManualRuntimeFactoryClass() {
    return ManualRuntimeFactory;
  }

  getManualRuntimeFactory() {
    const FactoryClass = this.getManualRuntimeFactoryClass();
    return new FactoryClass(
      this.getManualRuntimeClass(),
      () => this.resizeActionHandler(),
      () => this.shouldStop(),
      this.getRuntimeOptions()
    );
  }

  /**
   * Resets the shared stop signal used by runtimes.
   * @returns {void}
   */
  resetStopSignal() {
    if (!this.codeContainer) {
      return;
    }

    this.codeContainer.stopSignal = false;
    // Backwards compatibility for runtimes still reading the old flag.
    this.codeContainer.stop_signal = false;
  }

  /**
   * Disposes all active code containers.
   * @returns {void}
   */
  destroyCodeContainers() {
    this.codeContainer?.destroy?.();
    this.codeContainer = null;
    this.codeContainerParent = null;

    this.codeContainers.forEach((container) => {
      container?.destroy?.();
    });
    this.codeContainers.clear();
  }

  /**
   * Public teardown entrypoint for H5P lifecycle integrations.
   * @returns {void}
   */
  destroy() {
    this.teardownInternalFrameResizeSync();
    this.destroyCodeContainers();
  }

  /**
   * Builds a persistable state entry from a code container.
   * @param {object} container Code container.
   * @returns {object|null} Persistable state entry or null.
   */
  getContainerState(container) {
    return this.stateService.getContainerState(container);
  }

  /**
   * Applies a previously persisted state entry to a code container.
   * @param {object} container Code container.
   * @param {object} state Persisted state entry.
   * @returns {void}
   */
  applyContainerState(container, state = {}) {
    this.stateService.applyContainerState(container, state);
  }

  /**
   * Returns the current learner state for H5P persistence (called by the H5P framework).
   * Saves assignment and inline editor workspaces so code, Blockly and fill-blank
   * answers can be restored from extras.previousState on the next page load.
   * @returns {object|undefined} State object, or undefined when there is nothing to save.
   */
  getState() {
    const state = this.stateService.getState({
      assignmentContainer: this.codeContainer,
      contentContainers: this.codeContainers,
    }) || {};

    if (this.isMultipleChoiceQuestion() && this.multipleChoiceMode.selectedChoices.size > 0) {
      state.selectedChoices = this.getSelectedChoiceIds();
    }

    if (this.isSortQuestion() && this.answerGiven) {
      state.sortOrder = this.currentSortOrder;
    }

    if (this.isParsonsQuestion() && this.answerGiven) {
      state.parsonsOrder = this.parsonsMode.currentParsonsOrder;
    }

    if (this.hintCascade?.isEnabled() && this.hintCascade.getHintsRevealed() > 0) {
      state.hintsRevealed = this.hintCascade.getHintsRevealed();
    }

    if (this.failedChecks > 0) {
      state.failedChecks = this.failedChecks;
    }

    if (this.workedExampleRevealed) {
      state.workedExampleRevealed = true;
    }

    return Object.keys(state).length > 0 ? state : undefined;
  }

  /**
   * H5P framework persistence hook. The H5P core (h5p.js) calls
   * getCurrentState() for autosave and for saving on page unload;
   * getState() holds the actual serialization logic.
   * @returns {object|undefined} State object, or undefined when there is nothing to save.
   */
  getCurrentState() {
    return this.getState();
  }

  getL10n() {
    return this.l10n;
  }

  getQuestionName() {
    return 'h5p-codequestion';
  }

  getQuestionClassNames() {
    return [...new Set(['h5p-codequestion', this.getQuestionName()].filter(Boolean))];
  }

  getTitle() {
    return getCodeQuestionL10nValue(this.l10n, 'codeQuestionTitle');
  }

  getDescription() {
    return getCodeQuestionL10nValue(this.l10n, 'codeQuestionDescription');
  }

  getSolution() {
    return '';
  }

  /**
   * Decodes HTML entities in a code string.
   * @param {string} code - The encoded code string
   * @returns {string} The decoded code
   */
  getDecodedCode(code) {
    if (typeof code !== 'string') return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = code;
    return textarea.value;
  }

  addButtons() {
    if (this.hasRunButton) {
      this.addButton('run', this.l10n.run, () => this.runAction());
    }
    if (this.hasCheckButton) {
      this.addButton('check-answer', this.l10n.checkAnswer, () =>
        this.checkAction(),
      );
      // Assignment tasks use the always-visible reset button instead of a
      // retry button that only appears after checking.
      if (this.params.behaviour?.enableRetry !== false && !this.isAssignment()) {
        this.addButton('retry', this.l10n.retry, () => this.resetTask(), false);
      }
    }
    this.addHintButton();
    this.addResetButton();
  }

  /**
   * Registers the hint button of the didactic hint cascade. Each click
   * reveals the next authored hint; the button disables once all hints are
   * shown. Hint usage is persisted and reported via xAPI.
   * @returns {void}
   */
  addHintButton() {
    if (!this.hintCascade?.isEnabled()) {
      return;
    }

    this.addButton('hint', this.hintCascade.getButtonLabel(), () => this.hintAction());
    this.updateHintButtonState();
  }

  /**
   * Reveals the next hint, if any, and keeps the button label in sync.
   * @returns {void}
   */
  hintAction() {
    if (!this.hintCascade?.revealNextHint()) {
      return;
    }

    this.resizeActionHandler();
  }

  /**
   * Updates the hint button's disabled state and title after reveals.
   * @returns {void}
   */
  updateHintButtonState() {
    const button = this.getQuestionButton('hint');
    if (!button) {
      return;
    }

    button.title = this.hintCascade.getButtonTitle();
    button.disabled = !this.hintCascade.hasUnrevealedHints();
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
  }

  /**
   * Registers the always-visible reset button for tasks with an editor.
   * Resetting restores the authored starting code and clears persisted
   * learner state, so it is available before and after checking and also
   * for tasks without grading. Because this discards all learner work, the
   * click is guarded by a confirmation dialog.
   * @returns {void}
   */
  addResetButton() {
    if (!this.isAssignment()) {
      return;
    }
    this.addButton('reset-task', this.l10n.resetTask, () => this.resetTaskFromButton(), true, {}, {
      confirmationDialog: {
        enable: true,
        instance: this,
        l10n: {
          header: getCodeQuestionL10nValue(this.l10n, 'resetTaskConfirmHeader'),
          body: getCodeQuestionL10nValue(this.l10n, 'resetTaskConfirmBody'),
          cancelLabel: getCodeQuestionL10nValue(this.l10n, 'resetTaskConfirmCancel'),
          confirmLabel: getCodeQuestionL10nValue(this.l10n, 'resetTaskConfirm'),
        },
      },
    });
  }

  /**
   * Click handler of the reset button. When retrying is disabled and the
   * attempt has already been graded, only the workspace is reset so the
   * button cannot be used to bypass the single-attempt setting.
   * @returns {void}
   */
  resetTaskFromButton() {
    if (this.isCheckingAnswer) {
      return;
    }

    if (this.answerGiven && this.params.behaviour?.enableRetry === false) {
      this.resetWorkspace();
      this.resizeActionHandler();
      return;
    }

    this.resetTask();
  }

  /**
   * Swaps the check-answer button for retry once an attempt has been
   * evaluated, so learners have a clear way back into the exercise.
   * Assignment tasks keep the check button instead, so learners can fix
   * their code and check again without resetting it.
   * @returns {void}
   */
  showRetryAfterCheck() {
    const canRetry = this.params.behaviour?.enableRetry !== false;

    if (this.hasCheckButton && !(this.isAssignment() && canRetry)) {
      this.hideButton('check-answer');
    }

    if (canRetry) {
      this.showButton('retry');
    }
  }

  registerDomElements() {
    this.destroyCodeContainers();
    this.initializeParent();
    this.parentDiv.innerHTML = '';

    const contentDiv = this.createContentContainer();
    const contentPartsDiv = this.renderContentParts();

    contentDiv.append(contentPartsDiv);
    if (this.isMultipleChoiceQuestion()) {
      contentDiv.append(this.multipleChoiceMode.render());
    }
    if (this.isSortQuestion()) {
      contentDiv.append(this.sortItemsMode.render());
    }
    if (this.isParsonsQuestion()) {
      contentDiv.append(this.parsonsMode.render());
    }
    this.parentDiv.append(contentDiv);

    if (this.isAssignment()) {
      this.createCodeContainer();
      this.renderCodeContainer(contentPartsDiv);
      this.renderAssetsIfNeeded();
    }

    const hintPanel = this.hintCascade?.render?.();
    if (hintPanel) {
      this.parentDiv.append(hintPanel);
    }

    if (this.workedExampleRevealed && this.hasWorkedExample()) {
      const panel = this.buildWorkedExamplePanel();
      if (panel) {
        this.parentDiv.append(panel);
      }
    }

    this.renderButtonsAndTestCases();

    this.setContent(this.parentDiv);
    this.applyQuestionRootClass();
    this.setupInternalFrameResizeSync();
  }

  applyQuestionRootClass() {
    const questionRoot = this.parentDiv?.closest('.h5p-question');

    if (questionRoot) {
      questionRoot.classList.add(...this.getQuestionClassNames());
    }
  }

  isAssignment() {
    return (
      this.contentType === 'text_and_ide' ||
      this.contentType === 'ide_only'
    );
  }

  initializeParent() {
    if (!this.parentDiv) {
      throw new Error('parentDiv is not initialized');
    }
    this.parentDiv.id = this.codeQuestionUID;
    this.parentDiv.classList.add(...this.getQuestionClassNames());
  }

  /**
   * Creates the outer wrapper that holds all rendered content parts.
   * @returns {HTMLDivElement} Empty content container.
   */
  createContentContainer() {
    return this.contentPartRenderer.createContentContainer();
  }

  /**
   * Renders every authored content part into one wrapper element.
   * @returns {HTMLDivElement} Wrapper containing all rendered content parts.
   */
  renderContentParts() {
    return this.contentPartRenderer.renderContentParts();
  }

  /**
   * Renders one authored content part based on its type.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement|null} Rendered content part, or null for unknown types.
   */
  renderContentPart(content, index) {
    return this.contentPartRenderer.renderContentPart(content, index);
  }

  /**
   * Renders a markdown text content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement} The populated container.
   */
  renderTextContent(container, content, index) {
    return this.contentPartRenderer.renderTextContent(container, content, index);
  }

  /**
   * Resolves markdown asynchronously and appends the resulting DOM node.
   * This avoids rendering Promise objects as text when markdown rendering is async.
   * @param {HTMLElement} container Target container.
   * @param {object} markdown H5P markdown instance.
   * @returns {void}
   */
  appendResolvedMarkdown(container, markdown) {
    return this.contentPartRenderer.appendResolvedMarkdown(container, markdown);
  }

  /**
   * Determines whether an inline content code editor should be shown.
   * Supports both legacy top-level `showEditor` and nested `options.showEditor`.
   * @param {object} content - Inline content item params.
   * @returns {boolean} True if an editor should be rendered.
   */
  shouldShowInlineEditor(content = {}) {
    return this.contentPartRenderer.shouldShowInlineEditor(content);
  }

  /**
   * Returns markdown renderer options shared with CodeContainer-based views.
   * @param {object|null} [contentParams] Optional inline content item params.
   * @returns {object} Markdown runtime options.
   */
  getMarkdownOptions(contentParams = null) {
    return this.contentPartRenderer.getMarkdownOptions(contentParams);
  }

  /**
   * Renders an inline code content part, either as a read-only markdown
   * code block or as a live inline editor.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement} The populated container.
   */
  renderCodeContent(container, content, index) {
    return this.contentPartRenderer.renderCodeContent(container, content, index);
  }

  /**
   * Renders a collapsible reference-solution code content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement} The populated container.
   */
  renderSolutionCodeContent(container, content, index) {
    return this.contentPartRenderer.renderSolutionCodeContent(container, content, index);
  }

  /**
   * Renders an image content part.
   * @param {HTMLElement} container Target container.
   * @param {object} content Authored content part params.
   * @param {number} index Position within the contents array.
   * @returns {HTMLElement} The populated container.
   */
  renderImageContent(container, content, index) {
    return this.contentPartRenderer.renderImageContent(container, content, index);
  }

  createCodeContainer() {
    this.codeContainerParent = document.createElement('div');
    this.codeContainerParent.id = `assignment-editor-wrapper-${H5P.createUUID()}`;

    this.codeContainer = this.getContainerFactory(
      this.codeContainerParent,
      this.defaultCode,
      true,
    ).create();

    this.applyContainerState(
      this.codeContainer,
      this.extras?.previousState?.assignmentState,
    );
  }

  renderCodeContainer(contentPartsDiv) {
    contentPartsDiv.append(this.codeContainerParent);
  }

  renderAssetsIfNeeded() {
    if (this.hasAssets) {
      this.parentDiv.append(this.generateAssetsArea());
    }
  }

  renderButtonsAndTestCases() {
    if (!this.gradingMethod) {
      // Without grading there is no check/retry flow, but the task can still
      // be reset.
      this.addResetButton();
      return;
    }
    this.addButtons();
    if (
      !this.isMultipleChoiceQuestion()
      && !this.isSortQuestion()
      && !this.isParsonsQuestion()
      && this.hasTestCaseArea
    ) {
      this.parentDiv.append(this.codeTester.view.getDOM());
    }
  }

  /* ------------------------------------------------------------------ *
   *  Multiple choice / sort item mode access
   *
   *  These properties and methods exist so external callers (and the
   *  mode classes' own DOM handlers) can keep addressing state the way
   *  they did before the multipleChoice/sortItems grading methods were
   *  extracted into MultipleChoiceMode/SortItemsMode. See DEVELOP.md.
   * ------------------------------------------------------------------ */

  get multipleChoice() {
    return this.multipleChoiceMode.settings;
  }

  get selectedChoices() {
    return this.multipleChoiceMode.selectedChoices;
  }

  get multipleChoiceFieldset() {
    return this.multipleChoiceMode.fieldset;
  }

  get sortQuestion() {
    return this.sortItemsMode.settings;
  }

  get currentSortOrder() {
    return this.sortItemsMode.currentSortOrder;
  }

  set currentSortOrder(order) {
    this.sortItemsMode.currentSortOrder = order;
  }

  get sortItemElements() {
    return this.sortItemsMode.sortItemElements;
  }

  get draggedSortItemId() {
    return this.sortItemsMode.draggedSortItemId;
  }

  handleChoiceChange(input) {
    this.multipleChoiceMode.handleChoiceChange(input);
  }

  getSelectedChoiceIds() {
    return this.multipleChoiceMode.getSelectedChoiceIds();
  }

  getCorrectChoiceIds() {
    return this.multipleChoiceMode.getCorrectChoiceIds();
  }

  moveSortItem(itemId, direction) {
    this.sortItemsMode.moveItem(itemId, direction);
  }

  handleSortDragStart(event, itemId) {
    this.sortItemsMode.handleDragStart(event, itemId);
  }

  handleSortDragOver(event, itemId) {
    this.sortItemsMode.handleDragOver(event, itemId);
  }

  handleSortDrop(event) {
    this.sortItemsMode.handleDrop(event);
  }

  handleSortDragEnd() {
    this.sortItemsMode.handleDragEnd();
  }

  setSortLocked(locked) {
    this.sortItemsMode.setLocked(locked);
  }

  applySortFeedback() {
    this.sortItemsMode.applyFeedback();
  }

  generateAssetsArea() {
    const div = document.createElement('div');
    div.id = this.assetsAreaUID;
    return div;
  }

  getAnswerGiven() {
    return this.answerGiven;
  }

  getScore() {
    let score;
    if (this.isMultipleChoiceQuestion()) {
      score = this.multipleChoiceMode.hasCorrectSelection() ? this.maxScore : 0;
    }
    else if (this.isSortQuestion()) {
      score = this.sortItemsMode.hasCorrectOrder() ? this.maxScore : 0;
    }
    else if (this.isParsonsQuestion()) {
      score = this.parsonsMode.hasCorrectOrder() ? this.maxScore : 0;
    }
    else {
      if (!this.codeTester || typeof this.codeTester.getScore !== 'function') {
        return 0;
      }
      score = this.codeTester.getScore() * 2;
    }

    if (this.isLateSubmission()) {
      score = Math.min(score, this.maxScore / 2);
    }
    return Math.min(score, this.maxScore);
  }

  getMaxScore() {
    return this.maxScore;
  }

  showSolutions() {
    return;
  }

  getContainer() {
    return document.getElementById(this.codeQuestionUID);
  }

  resetTask() {
    this.removeFeedback();

    if (this.hasRunButton) this.showButton('run');
    if (this.hasStopButton) this.showButton('stop');
    if (this.hasCheckButton) this.showButton('check-answer');
    this.hideButton('retry');

    this.resetWorkspace();
    this.codeTester?.reset?.();
    this.answerGiven = false;
    this.multipleChoiceMode.reset();
    this.getContainer()
      ?.querySelectorAll?.('.codequestion-multiple-choice input')
      ?.forEach((input) => {
        input.checked = false;
      });

    if (this.isSortQuestion()) {
      this.sortItemsMode.reset();
    }

    if (this.isParsonsQuestion()) {
      this.parsonsMode.reset();
    }

    this.resizeActionHandler();
  }

  /**
   * Restores all editors to their authored starting state: stops running
   * programs, resets the code, clears the console and discards persisted
   * learner state. Grading state is left untouched.
   * @returns {void}
   */
  resetWorkspace() {
    this.stopRunningCode();
    this.resetStopSignal();

    this.resetCodeContainer(this.codeContainer, this.defaultCode || '');
    this.codeContainers.forEach((container) => {
      this.resetCodeContainer(container);
    });

    this.codeContainer?.reset?.();
    this.clearPersistedState();
  }

  /**
   * Stops programs that are still running in any editor, so they do not
   * keep executing (and printing) the discarded code after a reset.
   * Container stop() tears the runtime down directly, so the shared stop
   * signal can be cleared afterwards for the next run.
   * @returns {void}
   */
  stopRunningCode() {
    [this.codeContainer, ...this.codeContainers.values()].forEach((container) => {
      const stateManager = container?.getStateManager?.();
      if (stateManager?.isRunning?.() || stateManager?.isPaused?.()) {
        container.stop?.();
      }
    });
  }

  /**
   * Restores a code container to its authored starting state. Prefers a full
   * workspace snapshot reset (which also discards learner-added files) and
   * falls back to replacing the entry-file code.
   * @param {object} container - Code container to reset.
   * @param {string|null} [fallbackCode] - Encoded starting code for the
   *   fallback path; when null and no default snapshot exists, the container
   *   is left untouched because its starting state is unknown.
   * @returns {void}
   */
  resetCodeContainer(container, fallbackCode = null) {
    const defaultSnapshot = container?.getDefaultWorkspaceSnapshot?.();

    if (defaultSnapshot && typeof container?.setWorkspaceSnapshot === 'function') {
      container.setWorkspaceSnapshot(defaultSnapshot);
      return;
    }

    if (fallbackCode === null) {
      return;
    }

    if (typeof container?.setCode === 'function') {
      container.setCode(this.getDecodedCode(fallbackCode));
    }
    else if (container?.session && typeof container?.set_decoded_code === 'function') {
      container.session.setValue(
        container.set_decoded_code(fallbackCode),
        -1,
      );
    }
  }

  /**
   * Clears persisted learner state so a reset survives page reloads: the
   * local workspace autosave is discarded immediately and the H5P-stored
   * state is deleted when the host supports user data.
   *
   * Embedded in a parent content type (Question Set, Course Presentation,
   * ...), the stored state belongs to the parent and also holds the other
   * sub-contents' answers, so it must not be deleted. The parent's next
   * autosave stores this instance's state, which is empty after the reset.
   * @returns {void}
   */
  clearPersistedState() {
    if (typeof this.codeContainer?.clearWorkspaceAutosave === 'function') {
      Promise.resolve(this.codeContainer.clearWorkspaceAutosave()).catch(() => {
        // Storage unavailable; nothing to discard.
      });
    }
    else {
      this.codeContainer?.scheduleWorkspaceAutosave?.();
    }

    if (this.subContentId || this.extras?.subContentId) {
      return;
    }

    try {
      if (typeof H5P?.deleteUserData === 'function') {
        H5P.deleteUserData(this.contentId, 'state', 0);
      }
    }
    catch {
      // Hosts without user data storage keep no state to delete.
    }
  }

  shouldStop() {
    return this.codeContainer?.stopSignal === true
      || this.codeContainer?.stop_signal === true;
  }


  success() {
    return this.getScore() > 0;
  }

  isLateSubmission() {
    if (this.enableDueDate && this.dueDate) {
      const now = new Date();
      const due = new Date(this.dueDate);
      return now > due;
    }
    return false;
  }
}
