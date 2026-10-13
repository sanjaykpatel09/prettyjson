import React, { useMemo, useState } from 'react';

const example = JSON.stringify({
  userId: 1,
  id: 1,
  title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
  body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
});

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [fileName, setFileName] = useState('formatted.json');
  const [message, setMessage] = useState('Paste JSON or load the example to get started.');
  const [kind, setKind] = useState('info');

  const stats = useMemo(() => ({
    chars: output.length,
    lines: output ? output.split('\n').length : 0,
  }), [output]);

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

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PrettyJSON home"><span className="brand-mark">{'{}'}</span> PrettyJSON</a>
        <span className="privacy"><span className="privacy-dot" /> Runs in your browser</span>
      </header>

      <section className="workspace" aria-label="JSON formatter">
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
      </section>

    </main>
  );
}
