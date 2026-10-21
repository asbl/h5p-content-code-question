import Util from './util';

/**
 * Builds and sends the xAPI statements (attempted/answered/completed) for a
 * CodeQuestion instance. Kept independent of DOM rendering so the statement
 * logic (and its own attempt-registration bookkeeping) can be reasoned about
 * and tested without the rest of the question lifecycle.
 */
export default class XAPIReporter {
  /**
   * @param {object} question Owning CodeQuestion instance.
   */
  constructor(question) {
    this.question = question;
    this.currentRegistration = null;
  }

  /**
   * Builds the result object for answered/completed statements.
   * Returns a fully populated statement-result object.
   * Used by sendAnsweredEvent, sendCompletedEvent, and getXAPIData.
   * @returns {object} xAPI result object
   */
  buildResultStatement() {
    const question = this.question;
    const score = question.getScore();
    const maxScore = question.getMaxScore();
    const result = {
      completion: true,
      success: question.success(),
      score: {
        scaled: maxScore > 0 ? score / maxScore : 0,
        raw: score,
        min: 0,
        max: maxScore
      },
      response: question.getResponse()
    };

    if (question.hintCascade?.isEnabled()) {
      result.extensions = {
        ...result.extensions,
        'https://opencoding.de/xapi/extension/hints-revealed': question.hintCascade.getHintsRevealed(),
      };
    }

    return result;
  }

  /**
   * Returns the learner's response in xAPI's own interaction-type format.
   * @returns {string} Serialized response.
   */
  getResponse() {
    const question = this.question;

    if (question.isMultipleChoiceQuestion()) {
      return question.getSelectedChoiceIds().join('[,]');
    }

    if (question.isSortQuestion()) {
      return question.currentSortOrder.join('[,]');
    }

    if (question.isParsonsQuestion()) {
      return question.parsonsMode.currentParsonsOrder.join('[,]');
    }

    return question.codeContainer?.getEditorManager?.()?.getCode() || '';
  }

  /**
   * Sends an xAPI "attempted" statement.
   * Moodle interprets this event as the start of a new attempt.
   * @returns {void}
   */
  sendAttemptedEvent() {
    // Force a new registration for a new attempt
    this.currentRegistration = H5P.createUUID();

    const ev = this.createBaseXAPIEvent('attempted');

    // Moodle ignores attempted statements that contain a result
    delete ev.data.statement.result;

    this.question.trigger(ev);
  }

  /**
   * Sends an xAPI "answered" statement.
   * Represents the learner's response and score.
   * @returns {void}
   */
  sendAnsweredEvent() {
    const ev = this.createBaseXAPIEvent('answered');
    // Attach a result using a helper
    ev.data.statement.result = this.buildResultStatement();

    this.question.trigger(ev);
  }

  /**
   * Sends an xAPI "completed" statement.
   * Marks the end of the attempt.
   * @returns {void}
   */
  sendCompletedEvent() {
    const ev = this.createBaseXAPIEvent('completed');

    // Attach a final result using helper
    ev.data.statement.result = this.buildResultStatement();

    this.question.trigger(ev);
  }

  /**
   * Returns xAPI statement data for answered events.
   * Used by Moodle reporting without sending an event.
   * @returns {object} xAPI statement object
   */
  getXAPIData() {
    const ev = this.createBaseXAPIEvent('answered');

    // Attach a result using a helper
    ev.data.statement.result = this.buildResultStatement();

    return { statement: ev.data.statement };
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
    const question = this.question;

    // Ensure a stable registration ID per attempt
    this.currentRegistration = this.currentRegistration || H5P.createUUID();

    // Create an event from a H5P template
    const ev = question.createXAPIEventTemplate(verb);

    // Explicitly set verb (some H5P versions omit it)
    ev.setVerb({
      id: `http://adlnet.gov/expapi/verbs/${verb}`,
      display: { 'en-US': verb },
    });

    // Extend object definition with activity metadata
    Util.extend(
      ev.getVerifiedStatementValue(['object', 'definition']),
      this.getxAPIDefinition()
    );

    const statement = ev.data.statement;

    // Required timestamp (ISO-8601)
    statement.timestamp = new Date().toISOString();

    // Context information (registration and platform)
    statement.context = statement.context || {};
    statement.context.registration = this.currentRegistration;
    statement.context.platform = window.location.origin;

    // Unique statement ID
    statement.id = `${verb}-${H5P.createUUID()}`;

    return ev;
  }

  /**
   * Returns the xAPI activity definition for this CodeQuestion.
   * This defines the "object" part of xAPI statements (name, description, type, interaction).
   * @returns {object} xAPI activity definition object
   */
  getxAPIDefinition() {
    const question = this.question;
    const def = {
      name: {},
      description: {},
      type: 'http://adlnet.gov/expapi/activities/cmi.interaction',
      interactionType: this.getxAPIInteractionType(),
      correctResponsesPattern: this.getCorrectResponsesPattern(),
    };

    // Localized names
    def.name[question.getCodingLanguage()] = question.getTitle();
    def.name['en-US'] = question.getTitle();

    // Localized descriptions
    def.description[question.getCodingLanguage()] = question.getDescription();
    def.description['en-US'] = question.getDescription();

    if (question.isMultipleChoiceQuestion()) {
      def.choices = question.multipleChoiceMode.settings.choices.map((choice) => ({
        id: choice.id,
        description: {
          [question.getCodingLanguage()]: choice.text,
          'en-US': choice.text,
        },
      }));
    }

    if (question.isSortQuestion()) {
      def.choices = question.sortItemsMode.settings.items.map((item) => ({
        id: item.id,
        description: {
          [question.getCodingLanguage()]: item.text,
          'en-US': item.text,
        },
      }));
    }

    if (question.isParsonsQuestion()) {
      def.choices = question.parsonsMode.settings.lines.map((line) => ({
        id: line.id,
        description: {
          [question.getCodingLanguage()]: line.code,
          'en-US': line.code,
        },
      }));
    }

    return def;
  }

  /**
   * Returns the xAPI interaction type for this CodeQuestion's current mode.
   * @returns {string} xAPI interaction type.
   */
  getxAPIInteractionType() {
    const question = this.question;

    if (question.isMultipleChoiceQuestion()) {
      return 'choice';
    }

    if (question.isSortQuestion() || question.isParsonsQuestion()) {
      return 'sequencing';
    }

    return 'other';
  }

  /**
   * Returns the xAPI correct-responses-pattern for this CodeQuestion's current mode.
   * @returns {string[]} Correct-responses pattern entries.
   */
  getCorrectResponsesPattern() {
    const question = this.question;

    if (question.isMultipleChoiceQuestion()) {
      const correctChoiceIds = question.getCorrectChoiceIds();
      return correctChoiceIds.length > 0 ? [correctChoiceIds.join('[,]')] : [];
    }

    if (question.isSortQuestion()) {
      const correctOrder = question.sortItemsMode.getCorrectItemIds();
      return correctOrder.length > 0 ? [correctOrder.join('[,]')] : [];
    }

    if (question.isParsonsQuestion()) {
      const correctOrder = question.parsonsMode.getCorrectLineIds();
      return correctOrder.length > 0 ? [correctOrder.join('[,]')] : [];
    }

    return ['response code by student'];
  }
}
