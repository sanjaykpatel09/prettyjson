import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const codeHighlighting = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: '#8b45c6', fontWeight: '600' },
  { tag: [tags.className, tags.typeName], color: '#2676b8', fontWeight: '600' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: '#167d83' },
  { tag: [tags.string, tags.special(tags.string)], color: '#218153' },
  { tag: [tags.number, tags.bool, tags.null], color: '#b45b18' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#8a8e9d', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: '#596078' },
  { tag: [tags.propertyName, tags.variableName], color: '#39405b' },
]);

export default function CodeEditor({ language, code, onChange }) {
  const extensions = useMemo(
    () => [
      language === 'python' ? python() : java(),
      syntaxHighlighting(codeHighlighting),
    ],
    [language],
  );

  return (
    <CodeMirror
      className="source-code-editor"
      aria-label={`${language === 'python' ? 'Python' : 'Java'} source code`}
      value={code}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        tabSize: 4,
      }}
    />
  );
}
