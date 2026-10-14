import React, { useMemo, useState } from 'react';

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

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PrettyJSON home"><span className="brand-mark">{'{}'}</span> PrettyJSON</a>
        <nav className="tabs" role="tablist" aria-label="JSON tools">
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
      ) : (
        <section className="about-workspace" id="about-panel" role="tabpanel" aria-labelledby="about-tab">
          <div className="about-intro">
            <span className="about-mark">{'{}'}</span>
            <div>
              <h1>About PrettyJSON</h1>
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
          </div>
          <p className="about-note">Your text is processed locally in your browser; PrettyJSON does not send it to a server.</p>
        </section>
      )}

    </main>
  );
}
