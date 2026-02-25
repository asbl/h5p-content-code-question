import CodeQuestion from '../scripts/h5p-codequestion';

import { ManualRuntimeMixin } from '../scripts/runtime/runtime-manual';
import { TestRuntimeMixin } from '../scripts/runtime/runtime-test';
import { SolutionRuntimeMixin } from '../scripts/runtime/runtime-solution';
// Tester
import IOTester from '../scripts/tester/io/tester-io.js';
import ImageTester from '../scripts/tester/image/tester-image.js';
// Factories
import CodeTesterFactory from '../scripts/tester/factory-tester';
import TestRuntimeFactory from '../scripts/runtime/factory-runtime-test.js';
import ManualRuntimeFactory from '../scripts/runtime/factory-runtime-manual.js';
import ContainerFactory from '../scripts/container/factory-container.js';
// Additional Classes which can be overwritten
import {Runtime} from '../scripts/runtime/runtime';
import CodeQuestionContainer from '../scripts/container/codequestion-container';
// css
import '../styles/h5p-code-question.css';
import '../styles/hljs.css'; // highlight.js

H5P.CodeQuestion = CodeQuestion;

H5P.TestRuntimeMixin = TestRuntimeMixin;
H5P.SolutionRuntimeMixin = SolutionRuntimeMixin;
H5P.ManualRuntimeMixin = ManualRuntimeMixin;

H5P.Runtime = Runtime;
H5P.CodeQuestionContainer = CodeQuestionContainer;

// Tester
H5P.IOTester = IOTester;
H5P.ImageTester = ImageTester;
H5P.CodeTesterFactory = CodeTesterFactory;

//Factories
H5P.CodeTesterFactory = CodeTesterFactory;
H5P.TestRuntimeFactory = TestRuntimeFactory;
H5P.ManualRuntimeFactory = ManualRuntimeFactory;
H5P.ContainerFactory = ContainerFactory;
