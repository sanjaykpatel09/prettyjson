function removeStringsAndComments(source, language) {
  const withoutStrings = source.replace(
    /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gu,
    (value) => value.replace(/[^\r\n]/gu, ' '),
  );

  return language === 'python'
    ? withoutStrings.replace(/#[^\r\n]*/gu, (value) => ' '.repeat(value.length))
    : withoutStrings.replace(/\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gu, (value) => value.replace(/[^\r\n]/gu, ' '));
}

function loopBodyContainsHalvingUpdate(lines, index, line, language) {
  const loopVariable = language === 'python'
    ? line.match(/\bwhile\s+([a-zA-Z_]\w*)/u)?.[1]
    : line.match(/\bwhile\s*\(\s*([a-zA-Z_$]\w*)/u)?.[1];
  if (!loopVariable) return false;

  const escapedVariable = loopVariable.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const updatePattern = new RegExp(
    `(?:\\b${escapedVariable}\\s*(?://=|/=|>>=)\\s*\\d+|\\b${escapedVariable}\\s*=\\s*${escapedVariable}\\s*(?://|/|>>)\\s*\\d+)`,
    'u',
  );

  if (updatePattern.test(line)) return true;

  if (language === 'python') {
    const indent = line.match(/^\s*/u)[0].replace(/\t/gu, '    ').length;
    for (const bodyLine of lines.slice(index + 1)) {
      if (!bodyLine.trim()) continue;
      const bodyIndent = bodyLine.match(/^\s*/u)[0].replace(/\t/gu, '    ').length;
      if (bodyIndent <= indent) break;
      if (updatePattern.test(bodyLine)) return true;
    }
    return false;
  }

  let bodyDepth = (line.match(/\{/gu) ?? []).length - (line.match(/\}/gu) ?? []).length;
  if (bodyDepth <= 0) return false;

  for (const bodyLine of lines.slice(index + 1)) {
    if (updatePattern.test(bodyLine)) return true;
    bodyDepth += (bodyLine.match(/\{/gu) ?? []).length - (bodyLine.match(/\}/gu) ?? []).length;
    if (bodyDepth <= 0) break;
  }
  return false;
}

function classifyLoop(line, language, lines, index) {
  const halvesBound = language === 'python'
    ? /\b\w+\s*(?::=|=)\s*\w+\s*(?:\/\/|\/|>>)\s*\d+|\b\w+\s*(?:\/\/=|\/=|>>=)\s*\d+/u.test(line)
    : /\b\w+\s*(?:\/=|>>=)\s*\d+|\b\w+\s*=\s*\w+\s*(?:\/|>>)\s*\d+/u.test(line);

  if (halvesBound || loopBodyContainsHalvingUpdate(lines, index, line, language)) {
    return 'logarithmic';
  }

  const fixedBound = language === 'python'
    ? /\brange\s*\(\s*\d+\s*(?:,\s*\d+\s*)?(?:,\s*[-+]?\d+\s*)?\)/u.test(line)
    : /;\s*\w+\s*(?:<|<=|>|>=)\s*\d+\s*;/u.test(line);

  return fixedBound ? 'constant' : 'linear';
}

function getLoopMatch(line, language) {
  if (language === 'python') {
    const statement = line.match(/^\s*(?:async\s+)?(?:for|while)\b/u);
    if (statement) return statement[0].trim();

    return /\bfor\s+\w+\s+in\b/u.test(line) ? line : null;
  }

  const match = line.match(/\b(?:for|while)\s*\([^)]*\)/u);
  return match?.[0] ?? null;
}

function findDeepestLoop(loops) {
  let deepest = { linear: 0, logarithmic: 0 };

  for (const chain of loops) {
    const complexity = chain.reduce((counts, loop) => {
      if (loop === 'linear') counts.linear += 1;
      if (loop === 'logarithmic') counts.logarithmic += 1;
      return counts;
    }, { linear: 0, logarithmic: 0 });

    if (
      complexity.linear > deepest.linear
      || (complexity.linear === deepest.linear && complexity.logarithmic > deepest.logarithmic)
    ) {
      deepest = complexity;
    }
  }

  return deepest.linear === 0 && deepest.logarithmic === 0
    ? 'O(1)'
    : `O(${[
      ...(deepest.linear > 0 ? [`n${deepest.linear > 1 ? `^${deepest.linear}` : ''}`] : []),
      ...(deepest.logarithmic > 0 ? [`log n${deepest.logarithmic > 1 ? `^${deepest.logarithmic}` : ''}`] : []),
    ].join(' ')})`;
}

function findLoopComplexity(source, language) {
  const loops = [];
  const lines = source.split(/\r\n|\r|\n/u);

  if (language === 'python') {
    const stack = [];
    for (const [index, line] of lines.entries()) {
      const match = getLoopMatch(line, language);
      if (!match) continue;

      const indent = line.match(/^\s*/u)[0].replace(/\t/gu, '    ').length;
      while (stack.length && stack.at(-1).indent >= indent) stack.pop();
      stack.push({ indent, complexity: classifyLoop(line, language, lines, index) });
      loops.push(stack.map((loop) => loop.complexity));
    }
  } else {
    const stack = [];
    let braceDepth = 0;
    for (const [index, line] of lines.entries()) {
      while (stack.length && stack.at(-1).bodyDepth > braceDepth) stack.pop();

      const match = getLoopMatch(line, language);
      if (match) {
        stack.push({
          bodyDepth: braceDepth + 1,
          complexity: classifyLoop(line, language, lines, index),
        });
        loops.push(stack.map((loop) => loop.complexity));
      }

      braceDepth += (line.match(/\{/gu) ?? []).length - (line.match(/\}/gu) ?? []).length;
    }
  }

  return findDeepestLoop(loops);
}

function findSpaceComplexity(source, language) {
  const allocatesByInputSize = language === 'python'
    ? /\[\s*[^\]]*\bfor\b|\{\s*[^}]*\bfor\b|\b(?:list|dict|set)\s*\(|\b\w+\s*=\s*\[\s*\][\s\S]*?\b\w+\s*\.\s*(?:append|extend)\s*\(/u.test(source)
    : /\bnew\s+[\w<>?,.\s]+\s*\[\s*[a-zA-Z_$]\w*\s*\]|\bnew\s+(?:ArrayList|LinkedList|HashMap|TreeMap|HashSet|TreeSet|ArrayDeque)\s*</u.test(source);

  return allocatesByInputSize ? 'O(n)' : 'O(1)';
}

export function estimateComplexity(language, source) {
  const cleanedSource = removeStringsAndComments(source, language);

  return {
    time: findLoopComplexity(cleanedSource, language),
    space: findSpaceComplexity(cleanedSource, language),
  };
}
