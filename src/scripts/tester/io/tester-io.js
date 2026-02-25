import { IOTesterView } from './view-tester-io.js';
import { IOComparator } from './comparator-io.js';
import CodeTester from '../tester.js';

export default class IOTester extends CodeTester {
  comparatorFactory() {
    return new IOComparator();
  }

  viewFactory() {
    return new IOTesterView(
      this.l10n,
      this.session,
      this.dueDate,
      this.enableDueDate,
    );
  }
}
