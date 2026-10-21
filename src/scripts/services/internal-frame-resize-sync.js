/**
 * Keeps the host iframe's height in sync while CodeQuestion runs inside an
 * H5P "internal frame" embed (isFramed && externalEmbed === false). That
 * embed mode does not auto-resize from H5P's own resize event, so this
 * polls document/body dimensions on a schedule and writes them directly
 * onto window.frameElement.
 *
 * Kept independent of the rest of the question lifecycle so the handful of
 * timers/observer it owns are not scattered across the main class.
 */
export default class InternalFrameResizeSync {
  /**
   * @param {object} question Owning CodeQuestion instance.
   */
  constructor(question) {
    this.question = question;
    this.evaluationFrameSyncTimerFast = null;
    this.evaluationFrameSyncTimerSlow = null;
    this.internalFrameLayoutSyncTimerFast = null;
    this.internalFrameLayoutSyncTimerSlow = null;
    this.internalFrameResizeDebounceTimer = null;
    this.internalFrameResizeObserver = null;
    this.boundInternalFrameResizeHandler = null;
  }

  /**
   * Writes the current document height onto the host iframe element.
   * @returns {void}
   */
  syncFramedHeightFallback() {
    const iframe = window.frameElement;

    if (!window.H5P?.isFramed || window.H5P?.externalEmbed !== false || !iframe || !document.body) {
      return;
    }

    const nextHeight = Math.ceil(Math.max(
      document.body.scrollHeight,
      document.documentElement?.scrollHeight || 0,
      document.body.getBoundingClientRect?.().height || 0,
    ));

    if (nextHeight > 0) {
      iframe.style.height = `${nextHeight}px`;
    }
  }

  /**
   * Schedules iframe-height resyncs after an evaluation (check/run/reset)
   * changed the visible content. Outside an internal frame, the normal
   * H5P resize event is sufficient.
   * @returns {void}
   */
  scheduleEvaluationFrameSync() {
    clearTimeout(this.evaluationFrameSyncTimerFast);
    clearTimeout(this.evaluationFrameSyncTimerSlow);

    const isInternalFrame = this.question.isInternalFrame();

    if (!isInternalFrame) {
      this.question.resizeActionHandler();
      return;
    }

    this.question.suppressInternalFrameResizeEvents = true;
    this.syncFramedHeightFallback();

    this.evaluationFrameSyncTimerFast = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 75);

    this.evaluationFrameSyncTimerSlow = setTimeout(() => {
      this.syncFramedHeightFallback();
      this.question.suppressInternalFrameResizeEvents = false;
    }, 350);
  }

  /**
   * Schedules iframe-height resyncs after the page's own layout changed
   * (e.g. a window/body resize), independent of an evaluation.
   * @returns {void}
   */
  scheduleInternalFrameLayoutSync() {
    clearTimeout(this.internalFrameLayoutSyncTimerFast);
    clearTimeout(this.internalFrameLayoutSyncTimerSlow);

    if (!this.question.isInternalFrame()) {
      return;
    }

    this.syncFramedHeightFallback();

    this.internalFrameLayoutSyncTimerFast = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 75);

    this.internalFrameLayoutSyncTimerSlow = setTimeout(() => {
      this.syncFramedHeightFallback();
    }, 250);
  }

  /**
   * Removes the window resize listener and ResizeObserver, if installed.
   * @returns {void}
   */
  teardownInternalFrameResizeSync() {
    clearTimeout(this.internalFrameResizeDebounceTimer);
    clearTimeout(this.internalFrameLayoutSyncTimerFast);
    clearTimeout(this.internalFrameLayoutSyncTimerSlow);

    this.internalFrameResizeObserver?.disconnect?.();
    this.internalFrameResizeObserver = null;

    if (this.boundInternalFrameResizeHandler) {
      window.removeEventListener('resize', this.boundInternalFrameResizeHandler);
      this.boundInternalFrameResizeHandler = null;
    }
  }

  /**
   * Installs the window resize listener and, when available, a
   * ResizeObserver on the document/parent elements, so internal-frame
   * embeds keep their iframe height in sync with layout changes.
   * @returns {void}
   */
  setupInternalFrameResizeSync() {
    this.teardownInternalFrameResizeSync();

    if (!this.question.isInternalFrame()) {
      return;
    }

    this.boundInternalFrameResizeHandler = () => {
      clearTimeout(this.internalFrameResizeDebounceTimer);
      this.internalFrameResizeDebounceTimer = setTimeout(() => {
        this.scheduleInternalFrameLayoutSync();
      }, 75);
    };

    window.addEventListener('resize', this.boundInternalFrameResizeHandler);

    if (typeof window.ResizeObserver === 'function') {
      this.internalFrameResizeObserver = new window.ResizeObserver(() => {
        clearTimeout(this.internalFrameResizeDebounceTimer);
        this.internalFrameResizeDebounceTimer = setTimeout(() => {
          this.scheduleInternalFrameLayoutSync();
        }, 50);
      });

      if (document.body) {
        this.internalFrameResizeObserver.observe(document.body);
      }

      if (document.documentElement) {
        this.internalFrameResizeObserver.observe(document.documentElement);
      }

      if (this.question.parentDiv) {
        this.internalFrameResizeObserver.observe(this.question.parentDiv);
      }
    }

    this.scheduleInternalFrameLayoutSync();
  }
}
