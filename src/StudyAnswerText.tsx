import type { ReactNode } from 'react';
import StudyMath, { MAX_MATH_LENGTH } from './StudyMath';

type MathBudget = { expressions: number; characters: number };
const MAX_MATH_EXPRESSIONS = 32;
const MAX_MATH_CHARACTERS = 8000;

function mathNode(latex: string, display: boolean, budget: MathBudget, key: string): ReactNode {
  const allowed = latex.length <= MAX_MATH_LENGTH && budget.expressions < MAX_MATH_EXPRESSIONS && budget.characters + latex.length <= MAX_MATH_CHARACTERS;
  if (allowed) { budget.expressions += 1; budget.characters += latex.length; }
  return <StudyMath key={key} latex={latex} display={display} allowed={allowed}/>;
}

/** Formatting is deliberately limited to React text nodes and semantic elements. */
function inlineText(text: string, budget: MathBudget): ReactNode[] {
  const tokens: ReactNode[] = [];
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`|\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$/g;
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > 0 && text[match.index - 1] === '\\') continue;
    if (match.index > offset) tokens.push(text.slice(offset, match.index));
    if (match[1] !== undefined) tokens.push(<strong key={`bold-${match.index}`}>{inlineText(match[1], budget)}</strong>);
    else if (match[2] !== undefined) tokens.push(<code key={`code-${match.index}`}>{match[2]}</code>);
    else tokens.push(mathNode(match[3] ?? match[4] ?? match[5] ?? match[6], match[3] !== undefined || match[4] !== undefined, budget, `math-${match.index}`));
    offset = pattern.lastIndex;
  }
  if (offset < text.length) tokens.push(text.slice(offset));
  return tokens;
}

type AnswerBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }
  | { type: 'math'; latex: string }
  | { type: 'code'; text: string };

function blocksFrom(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: Extract<AnswerBlock, { type: 'list' }> | undefined;
  function finishParagraph() {
    if (paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  }
  function finishList() { if (list) blocks.push(list); list = undefined; }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) { finishParagraph(); finishList(); continue; }
    if (/^\s*```/.test(line)) {
      finishParagraph(); finishList();
      const code: string[] = [];
      for (index += 1; index < lines.length && !/^\s*```\s*$/.test(lines[index]); index += 1) code.push(lines[index]);
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    const mathOpen = /^\s*(\$\$|\\\[)/.exec(line);
    if (mathOpen) {
      finishParagraph(); finishList();
      const closing = mathOpen[1] === '$$' ? '$$' : '\\]';
      const math: string[] = [];
      let part = line.slice(mathOpen[0].length);
      let closed = false;
      for (;;) {
        const closeAt = part.indexOf(closing);
        if (closeAt >= 0) {
          math.push(part.slice(0, closeAt));
          blocks.push({ type: 'math', latex: math.join('\n').trim() });
          const remainder = part.slice(closeAt + closing.length).trim();
          if (remainder) paragraph.push(remainder);
          closed = true;
          break;
        }
        math.push(part);
        if (index + 1 >= lines.length) break;
        part = lines[++index];
      }
      if (!closed) blocks.push({ type: 'paragraph', lines: [mathOpen[1], ...math] });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      finishParagraph(); finishList();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }
    const bullet = /^\s{0,3}[-*+]\s+(.+)$/.exec(line);
    const numbered = /^\s{0,3}(\d{1,3})[.)]\s+(.+)$/.exec(line);
    if (bullet || numbered) {
      finishParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) finishList();
      if (!list) list = { type: 'list', ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      list.items.push(bullet ? bullet[1] : numbered![2]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    finishList();
    paragraph.push(line);
  }
  finishParagraph(); finishList();
  return blocks;
}

export default function StudyAnswerText({ text }: { text: string }) {
  const budget: MathBudget = { expressions: 0, characters: 0 };
  return <div className="material-answer-text">{blocksFrom(text).map((block, index) => {
    if (block.type === 'heading') return <h4 key={index} className={`material-answer-heading material-answer-level-${block.level}`}>{inlineText(block.text, budget)}</h4>;
    if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === 'math') return mathNode(block.latex, true, budget, `block-math-${index}`);
    if (block.type === 'list') {
      const children = block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineText(item, budget)}</li>);
      return block.ordered ? <ol key={index} start={block.start}>{children}</ol> : <ul key={index}>{children}</ul>;
    }
    return <p key={index}>{inlineText(block.lines.join('\n'), budget)}</p>;
  })}</div>;
}
