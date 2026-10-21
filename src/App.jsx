import React, { lazy, Suspense, useMemo, useState } from 'react';
import { estimateComplexity } from './complexity.js';

const CodeEditor = lazy(() => import('./CodeEditor.jsx'));

const codeExamples = {
  python: 'print("Hello, world!")\n',
  java: 'class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, world!");\n    }\n}\n',
};

const codeRuntimes = {
  python: { compiler: 'cpython-3.13.8' },
  java: { compiler: 'openjdk-jdk-22+36' },
};

function formatRunDuration(durationMs) {
  return durationMs < 1000
    ? `${Math.round(durationMs)} ms`
    : `${(durationMs / 1000).toFixed(2)} s`;
}

const example = JSON.stringify({
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
});

function collectDifferences(left, right, path = '$', differences = []) {
  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);

  if (leftIsArray !== rightIsArray) {
    differences.push({ path, left, right });
    return differences;
  }

  if (leftIsArray) {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const itemPath = `${path}[${index}]`;
      if (index >= left.length) {
        differences.push({ path: itemPath, right: right[index] });
      } else if (index >= right.length) {
        differences.push({ path: itemPath, left: left[index] });
      } else {
        collectDifferences(left[index], right[index], itemPath, differences);
      }
    }
    return differences;
  }

  const leftIsObject = left !== null && typeof left === 'object';
  const rightIsObject = right !== null && typeof right === 'object';
  if (leftIsObject !== rightIsObject || !leftIsObject) {
    if (!Object.is(left, right)) differences.push({ path, left, right });
    return differences;
  }

  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    const itemPath = `${path}[${JSON.stringify(key)}]`;
    const hasLeft = Object.hasOwn(left, key);
    const hasRight = Object.hasOwn(right, key);
    if (!hasLeft) {
      differences.push({ path: itemPath, right: right[key] });
    } else if (!hasRight) {
      differences.push({ path: itemPath, left: left[key] });
    } else {
      collectDifferences(left[key], right[key], itemPath, differences);
    }
  }

  return differences;
}

function formatDifferenceValue(value, exists) {
  return exists ? JSON.stringify(value, null, 2) : 'Missing';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('format');
  const [countText, setCountText] = useState('');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [fileName, setFileName] = useState('formatted.json');
  const [message, setMessage] = useState('Paste JSON or load the example to get started.');
  const [kind, setKind] = useState('info');
  const [leftJson, setLeftJson] = useState('');
  const [rightJson, setRightJson] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareMessage, setCompareMessage] = useState('Enter two JSON values and compare them.');
  const [compareKind, setCompareKind] = useState('info');
  const [codeLanguage, setCodeLanguage] = useState('java');
  const [code, setCode] = useState(codeExamples.java);
  const [sourceFileName, setSourceFileName] = useState('Main.java');
  const [stdin, setStdin] = useState('');
  const [programOutput, setProgramOutput] = useState('');
  const [runMessage, setRunMessage] = useState('Ready to run your program.');
  const [runKind, setRunKind] = useState('info');
  const [isRunning, setIsRunning] = useState(false);
  const [runDurationMs, setRunDurationMs] = useState(null);
  const [complexityEstimate, setComplexityEstimate] = useState(null);

  const stats = useMemo(() => ({
    chars: output.length,
    lines: output ? output.split('\n').length : 0,
  }), [output]);

  const textStats = useMemo(() => ({
    characters: Array.from(countText).length,
    charactersWithoutWhitespace: Array.from(countText).filter((character) => !/\s/u.test(character)).length,
    words: countText.trim() ? countText.trim().split(/\s+/u).length : 0,
    lines: countText ? countText.split(/\r\n|\r|\n/u).length : 0,
  }), [countText]);

  function parseInput() {
    if (!input.trim()) throw new Error('Enter some JSON first.');
    return JSON.parse(input);
  }

  function formatJson() {
    try {
      const value = parseInput();
      const result = JSON.stringify(value, null, 2);
      setOutput(result);
      setMessage('Valid JSON — formatted with 2-space indentation.');
      setKind('success');
    } catch (error) {
      setMessage(error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : error.message);
      setKind('error');
    }
  }

  function minifyJson() {
    try {
      const result = JSON.stringify(parseInput());
      setOutput(result);
      setMessage('Valid JSON — minified successfully.');
      setKind('success');
    } catch (error) {
      setMessage(error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : error.message);
      setKind('error');
    }
  }

  function validateJson() {
    try {
      parseInput();
      setMessage('Valid JSON — no syntax errors found.');
      setKind('success');
    } catch (error) {
      setMessage(error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : error.message);
      setKind('error');
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setMessage('Output copied to clipboard.');
      setKind('success');
    } catch {
      setMessage('Clipboard access was blocked by your browser. Select and copy the output.');
      setKind('error');
    }
  }

  function downloadOutput() {
    if (!output) return;
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) {
      setMessage('Enter a file name before downloading.');
      setKind('error');
      return;
    }

    const downloadName = /\.json$/i.test(trimmedFileName)
      ? trimmedFileName
      : `${trimmedFileName}.json`;
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`Downloaded ${downloadName}.`);
    setKind('success');
  }

  function downloadSourceCode() {
    const sanitizedName = sourceFileName.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/gu, '_');
    if (!sanitizedName) {
      setRunMessage('Enter a file name before downloading.');
      setRunKind('error');
      return;
    }

    const extension = codeLanguage === 'python' ? '.py' : '.java';
    const downloadName = /\.(?:py|java)$/iu.test(sanitizedName)
      ? sanitizedName.replace(/\.(?:py|java)$/iu, extension)
      : `${sanitizedName}${extension}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setRunMessage(`Downloaded ${downloadName}.`);
    setRunKind('success');
  }

  function loadExample() {
    setInput(example);
    setOutput('');
    setMessage('JSONPlaceholder post example loaded. Choose Format, Minify, or Validate.');
    setKind('info');
  }

  function clearAll() {
    setInput('');
    setOutput('');
    setMessage('Paste JSON or load the example to get started.');
    setKind('info');
  }

  function compareJson() {
    try {
      if (!leftJson.trim() || !rightJson.trim()) {
        throw new Error('Enter JSON in both editors before comparing.');
      }

      const leftValue = JSON.parse(leftJson);
      const rightValue = JSON.parse(rightJson);
      const differences = collectDifferences(leftValue, rightValue);
      setComparison(differences);
      setCompareMessage(
        differences.length === 0
          ? 'The JSON values match.'
          : `Found ${differences.length} difference${differences.length === 1 ? '' : 's'}.`,
      );
      setCompareKind('success');
    } catch (error) {
      setComparison(null);
      setCompareMessage(error instanceof SyntaxError ? `Invalid JSON: ${error.message}` : error.message);
      setCompareKind('error');
    }
  }

  function updateCompareInput(setter, value) {
    setter(value);
    setComparison(null);
    setCompareMessage('JSON changed. Compare again to see the differences.');
    setCompareKind('info');
  }

  async function runCode() {
    const runStartedAt = performance.now();
    setComplexityEstimate(estimateComplexity(codeLanguage, code));
    setIsRunning(true);
    setProgramOutput('');
    setRunDurationMs(null);
    setRunMessage('Connecting to the online runner…');
    setRunKind('info');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60_000);

    try {
      const runtime = codeRuntimes[codeLanguage];
      const codeToRun = codeLanguage === 'java'
        ? code.replace(/^(\s*)public\s+(?=class\s+Main\b)/m, '$1')
        : code;
      const response = await fetch('https://wandbox.org/api/compile.ndjson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compiler: runtime.compiler,
          code: codeToRun,
          stdin,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`The code runner returned HTTP ${response.status}. Please try again.`);
      }
      if (!response.body) {
        throw new Error('The online runner did not provide a readable response. Please try again.');
      }

      setRunMessage('Compiling and running…');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let output = '';
      let compilerError = '';
      let exitCode;
      let isFinished = false;

      function processEvent(line) {
        if (!line.trim()) return;

        const event = JSON.parse(line);
        if (event.type === 'StdOut' || event.type === 'StdErr' || event.type === 'CompilerMessage' || event.type === 'CompilerMessageE') {
          output += event.data;
          if (event.type === 'CompilerMessageE') compilerError += event.data;
          setProgramOutput(output.trimEnd());
        } else if (event.type === 'ExitCode') {
          exitCode = event.data;
          if (exitCode !== '0') {
            setRunMessage(compilerError ? 'Compilation failed.' : 'Program finished with an error.');
            setRunKind('error');
          } else {
            setRunMessage('Program is finishing…');
          }
        } else if (event.type === 'Control' && event.data === 'Finish') {
          isFinished = true;
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });

        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) processEvent(line);

        if (done) break;
      }
      processEvent(pending);

      if (exitCode === undefined || !isFinished) {
        throw new Error('The online runner ended before returning a complete result. Please try again.');
      }

      if (exitCode === '0') {
        setRunMessage('Program finished successfully.');
        setRunKind('success');
      }
    } catch (error) {
      setRunMessage(error instanceof Error && error.name === 'AbortError'
        ? 'The runner took longer than 60 seconds and was stopped. Please try again.'
        : error instanceof TypeError
          ? 'Could not reach the online runner. Check your connection and try again.'
          : error instanceof Error ? error.message : 'An unexpected error occurred while running your program.');
      setRunKind('error');
    } finally {
      window.clearTimeout(timeoutId);
      setRunDurationMs(performance.now() - runStartedAt);
      setIsRunning(false);
    }
  }

  function changeCodeLanguage(event) {
    const language = event.target.value;
    setCodeLanguage(language);
    setCode(codeExamples[language]);
    setSourceFileName(language === 'python' ? 'main.py' : 'Main.java');
    setProgramOutput('');
    setRunDurationMs(null);
    setComplexityEstimate(null);
    setRunMessage('Ready to run your program.');
    setRunKind('info');
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PrettyJSON home"><span className="brand-mark">{'{}'}</span> PrettyJSON</a>
        <nav className="tabs" role="tablist" aria-label="Developer tools">
          <button
            className={`tab ${activeTab === 'format' ? 'active' : ''}`}
            id="format-tab"
            role="tab"
            aria-selected={activeTab === 'format'}
            aria-controls="format-panel"
            onClick={() => setActiveTab('format')}
          >
            <span className="tab-label-wide">Format JSON</span>
            <span className="tab-label-compact">Format</span>
          </button>
          <button
            className={`tab ${activeTab === 'compare' ? 'active' : ''}`}
            id="compare-tab"
            role="tab"
            aria-selected={activeTab === 'compare'}
            aria-controls="compare-panel"
            onClick={() => setActiveTab('compare')}
          >
            <span className="tab-label-wide">Compare JSON</span>
            <span className="tab-label-compact">Compare</span>
          </button>
          <button
            className={`tab ${activeTab === 'count' ? 'active' : ''}`}
            id="count-tab"
            role="tab"
            aria-label="Count Characters"
            aria-selected={activeTab === 'count'}
            aria-controls="count-panel"
            onClick={() => setActiveTab('count')}
          >
            <span className="tab-label-wide">Count Characters</span>
            <span className="tab-label-compact">Count</span>
          </button>
          <button
            className={`tab ${activeTab === 'code' ? 'active' : ''}`}
            id="code-tab"
            role="tab"
            aria-label="Code"
            aria-selected={activeTab === 'code'}
            aria-controls="code-panel"
            onClick={() => setActiveTab('code')}
          >
            <span className="tab-label-wide">Code</span>
            <span className="tab-label-compact">Code</span>
          </button>
          <button
            className={`tab ${activeTab === 'about' ? 'active' : ''}`}
            id="about-tab"
            role="tab"
            aria-label="About PrettyJSON"
            aria-selected={activeTab === 'about'}
            aria-controls="about-panel"
            onClick={() => setActiveTab('about')}
          >
            <span className="tab-label-wide">About</span>
            <span className="tab-label-compact">About</span>
          </button>
        </nav>
      </header>

      {activeTab === 'format' ? <section className="workspace" id="format-panel" role="tabpanel" aria-labelledby="format-tab" aria-label="JSON formatter">
        <div className="panel">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>Input JSON</h2></div>
            <button className="text-button icon-text-button" onClick={loadExample}>
              <svg aria-hidden="true" viewBox="0 0 16 16">
                <path d="M4.5 1.75h5l3 3v9.5h-8z" />
                <path d="M9.5 1.75v3h3M6.5 8.5l-1 1 1 1m3-2 1 1-1 1M8.75 8l-1.5 3" />
              </svg>
              Load post example
            </button>
          </div>
          <textarea
            aria-label="Input JSON"
            spellCheck="false"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={'Paste your JSON here…\n\n{"hello":"world"}'}
          />
          <div className="panel-footer"><span>{input.length.toLocaleString()} characters</span><button className="text-button muted" onClick={clearAll}>Clear</button></div>
        </div>

        <div className="actions" aria-label="JSON actions">
          <button className="primary-button" onClick={formatJson}><span>✦</span> Format JSON</button>
          <button className="secondary-button" onClick={minifyJson}>Minify</button>
          <button className="secondary-button" onClick={validateJson}>Validate</button>
        </div>

        <div className="panel output-panel">
          <div className="panel-heading">
            <div className="output-title">
              <span className="step">02</span>
              <h2>Output</h2>
              <label className="visually-hidden" htmlFor="download-filename">Download file name</label>
              <input
                className="filename-input"
                id="download-filename"
                type="text"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                aria-describedby="filename-hint"
              />
              <span className="visually-hidden" id="filename-hint">The .json extension is added if omitted.</span>
            </div>
            <div className="output-actions">
              <button className="text-button icon-text-button" onClick={copyOutput} disabled={!output}>
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <rect x="5.25" y="5.25" width="8.5" height="9" rx="1.25" />
                  <path d="M10.75 5.25v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1.5" />
                </svg>
                Copy
              </button>
              <button className="text-button icon-text-button" onClick={downloadOutput} disabled={!output}>
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="M8 1.75v8m0 0 3-3m-3 3-3-3M2.25 10.5v2.25a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1V10.5" />
                </svg>
                Download
              </button>
            </div>
          </div>
          <textarea
            aria-label="Formatted JSON output"
            spellCheck="false"
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            placeholder="Your result will appear here…"
          />
          {output && <div className="panel-footer output-stats"><span>{stats.lines} lines</span><span>{stats.chars.toLocaleString()} characters</span></div>}
          <div className={`status ${kind}`} role="status"><span className="status-icon">{kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i'}</span>{message}</div>
        </div>
      </section> : activeTab === 'compare' ? (
        <section className="compare-workspace" id="compare-panel" role="tabpanel" aria-labelledby="compare-tab" aria-label="Compare JSON">
          <div className="compare-editors">
            <div className="panel compare-editor">
              <div className="panel-heading">
                <div><span className="step">A</span><h2>Original JSON</h2></div>
              </div>
              <textarea
                aria-label="Original JSON"
                spellCheck="false"
                value={leftJson}
                onChange={(event) => updateCompareInput(setLeftJson, event.target.value)}
                placeholder={'Paste the original JSON here…\n\n{"hello":"world"}'}
              />
              <div className="panel-footer"><span>{leftJson.length.toLocaleString()} characters</span></div>
            </div>
            <div className="panel compare-editor">
              <div className="panel-heading">
                <div><span className="step">B</span><h2>Modified JSON</h2></div>
              </div>
              <textarea
                aria-label="Modified JSON"
                spellCheck="false"
                value={rightJson}
                onChange={(event) => updateCompareInput(setRightJson, event.target.value)}
                placeholder={'Paste the modified JSON here…\n\n{"hello":"there"}'}
              />
              <div className="panel-footer"><span>{rightJson.length.toLocaleString()} characters</span></div>
            </div>
          </div>
          <div className="compare-controls">
            <button className="primary-button" onClick={compareJson}>Compare JSON</button>
            <div className={`status ${compareKind}`} role="status">
              <span className="status-icon">{compareKind === 'success' ? '✓' : compareKind === 'error' ? '!' : 'i'}</span>
              {compareMessage}
            </div>
          </div>
          <div className="panel differences-panel">
            <div className="panel-heading">
              <div><span className="step">{comparison?.length ?? '—'}</span><h2>Differences</h2></div>
            </div>
            {comparison && comparison.length > 0 ? (
              <div className="differences-list">
                {comparison.map((difference) => (
                  <article className="difference" key={difference.path}>
                    <code className="difference-path">{difference.path}</code>
                    <div className="difference-values">
                      <pre className={Object.hasOwn(difference, 'left') ? 'changed-value' : 'missing-value'}>
                        <span>Original</span>
                        {formatDifferenceValue(difference.left, Object.hasOwn(difference, 'left'))}
                      </pre>
                      <pre className={Object.hasOwn(difference, 'right') ? 'changed-value' : 'missing-value'}>
                        <span>Modified</span>
                        {formatDifferenceValue(difference.right, Object.hasOwn(difference, 'right'))}
                      </pre>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-differences">
                {comparison ? 'No differences found.' : 'Compare the JSON values to see changes here.'}
              </p>
            )}
          </div>
        </section>
      ) : activeTab === 'count' ? (
        <section className="count-workspace" id="count-panel" role="tabpanel" aria-labelledby="count-tab" aria-label="Count characters">
          <div className="panel count-panel">
            <div className="panel-heading">
              <div><span className="step">Aa</span><h2>Text to count</h2></div>
              <button className="text-button muted" onClick={() => setCountText('')}>Clear</button>
            </div>
            <textarea
              aria-label="Text to count"
              value={countText}
              onChange={(event) => setCountText(event.target.value)}
              placeholder="Type or paste text here…"
            />
          </div>
          <div className="count-summary" aria-live="polite">
            <div className="count-card"><span>Characters</span><strong>{textStats.characters.toLocaleString()}</strong></div>
            <div className="count-card"><span>Without whitespace</span><strong>{textStats.charactersWithoutWhitespace.toLocaleString()}</strong></div>
            <div className="count-card"><span>Words</span><strong>{textStats.words.toLocaleString()}</strong></div>
            <div className="count-card"><span>Lines</span><strong>{textStats.lines.toLocaleString()}</strong></div>
          </div>
        </section>
      ) : activeTab === 'code' ? (
        <section className="code-workspace" id="code-panel" role="tabpanel" aria-labelledby="code-tab" aria-label="Online code runner">
          <div className="code-editors">
            <div className="panel code-editor">
              <div className="panel-heading">
                <div><span className="step">01</span><h2>Program</h2></div>
                <div className="code-file-controls">
                  <label className="visually-hidden" htmlFor="source-filename">Source file name</label>
                  <input
                    className="source-filename-input"
                    id="source-filename"
                    type="text"
                    value={sourceFileName}
                    onChange={(event) => setSourceFileName(event.target.value)}
                    aria-label="Source file name"
                  />
                  <button className="text-button" onClick={downloadSourceCode} disabled={!code.trim()}>Download</button>
                </div>
                <label className="language-select-label" htmlFor="code-language">Language</label>
                <select id="code-language" className="language-select" value={codeLanguage} onChange={changeCodeLanguage}>
                  <option value="java">Java 22</option>
                  <option value="python">Python 3.13</option>
                </select>
              </div>
              <Suspense fallback={<div className="editor-loading">Loading code editor…</div>}>
                <CodeEditor
                  language={codeLanguage}
                  code={code}
                  onChange={(value) => {
                    setCode(value);
                    setRunDurationMs(null);
                    setComplexityEstimate(null);
                  }}
                />
              </Suspense>
            </div>
            <div className="code-side">
              <div className="panel stdin-panel">
                <div className="panel-heading">
                  <div><span className="step">02</span><h2>Input (stdin)</h2></div>
                </div>
                <textarea
                  aria-label="Program input"
                  spellCheck="false"
                  value={stdin}
                  onChange={(event) => {
                    setStdin(event.target.value);
                    setRunDurationMs(null);
                  }}
                  placeholder="Optional input passed to your program…"
                />
              </div>
              <div className="panel program-output-panel">
                <div className="panel-heading">
                  <div><span className="step">03</span><h2>Output</h2></div>
                </div>
                <pre className="program-output" aria-live="polite">{programOutput || 'Your program output will appear here…'}</pre>
              </div>
            </div>
          </div>
          <div className="run-controls">
            <button className="primary-button" onClick={runCode} disabled={isRunning || !code.trim()}>
              {isRunning ? 'Running…' : '▶ Run Program'}
            </button>
            <div className={`status ${runKind}`} role="status">
              <span className="status-icon">{runKind === 'success' ? '✓' : runKind === 'error' ? '!' : 'i'}</span>
              {runMessage}
            </div>
          </div>
          <div className="run-metrics" aria-label="Run metrics and complexity">
            <div className="run-metric">
              <span>Compile + execution</span>
              <strong>{runDurationMs === null ? (isRunning ? 'Running…' : '—') : formatRunDuration(runDurationMs)}</strong>
              <small>Browser-measured total time</small>
            </div>
            <div className="run-metric">
              <span>Time complexity</span>
              <strong>{complexityEstimate?.time ?? (isRunning ? 'Analyzing…' : 'Run to analyze')}</strong>
              <small>Static heuristic estimate</small>
            </div>
            <div className="run-metric">
              <span>Space complexity</span>
              <strong>{complexityEstimate?.space ?? (isRunning ? 'Analyzing…' : 'Run to analyze')}</strong>
              <small>Static heuristic estimate</small>
            </div>
          </div>
          <p className="runner-disclosure">
            Big-O values are rough local estimates based on loop nesting and common collection allocations; recursion and complex control flow may not be detected. Elapsed time includes network and runner startup. Code and stdin are sent to Wandbox for execution; do not submit passwords, API keys, or other sensitive information.
          </p>
        </section>
      ) : (
        <section className="about-workspace" id="about-panel" role="tabpanel" aria-labelledby="about-tab">
          <div className="about-intro">
            <span className="about-mark">{'{}'}</span>
            <div>
              <h2>About PrettyJSON</h2>
              <p>A simple set of tools for working with JSON and text.</p>
            </div>
          </div>
          <div className="about-features">
            <article className="about-card">
              <span className="about-card-icon">{'{ }'}</span>
              <h2>Format, minify &amp; validate</h2>
              <p>Make JSON easier to read, compact it for use, or check that it is valid. Copy the result or download it with your chosen file name.</p>
            </article>
            <article className="about-card">
              <span className="about-card-icon">A ↔ B</span>
              <h2>Compare JSON</h2>
              <p>Compare two JSON values and see changed, added, or missing values by path. Object key order does not affect the comparison.</p>
            </article>
            <article className="about-card">
              <span className="about-card-icon">Aa</span>
              <h2>Count characters</h2>
              <p>Count characters, characters without whitespace, words, and lines as you type or paste text.</p>
            </article>
            <article className="about-card">
              <span className="about-card-icon">&gt;_</span>
              <h2>Run Java &amp; Python</h2>
              <p>Write a program, provide optional standard input, and run it online with Java 22 or Python 3.13.</p>
            </article>
          </div>
          <p className="about-note">JSON and text tools run in your browser. Code and program input are sent to Wandbox for execution; do not submit secrets.</p>
        </section>
      )}

    </main>
  );
}
