import Runtime from "../scripts/codequestion-runtime";
import CodeQuestion from "../scripts/h5p-codequestion";
import CodeTester from "../scripts/codequestion-tester";
import CodeQuestionFactory from "../scripts/codequestion-factory";
import "../styles/h5p-code-question.css";
import "../styles/hljs.css";

// Load l
H5P.CodeQuestionFactory = CodeQuestionFactory;
H5P.Runtime = Runtime;
H5P.CodeTester = CodeTester;
H5P.CodeQuestion = CodeQuestion;
