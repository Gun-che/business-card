import { Nullable } from 'src/app/types/nullable';

// Знаки препинания и кавычки по краям слова не нужны
const TRIM = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * Слово под точкой экрана. В `shaking-text` буквы разбиты по span'ам — берём индекс кликнутой
 * буквы в полном тексте; в обычном тексте — позицию каретки. Дальше расширяем до границ слова
 */
export function wordAtPoint(x: number, y: number): Nullable<string> {
  const element = document.elementFromPoint(x, y);
  const letter = element?.closest('.letter');
  const shaking = element?.closest('.shaking-text');
  if (letter && shaking) {
    const letters = Array.from(shaking.querySelectorAll('.letter'));
    const index = letters.indexOf(letter);
    return wordAround(letters.map(el => el.textContent ?? ''), index);
  }

  const caret = caretAtPoint(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  // Смещение каретки — в единицах UTF-16, а эмодзи занимают две; переводим в индекс символа
  const text = caret.node.textContent ?? '';
  const index = Array.from(text.slice(0, caret.offset)).length;
  return wordAround(Array.from(text), index);
}

function wordAround(chars: string[], index: number): Nullable<string> {
  const isSpace = (char: string) => /\s/.test(char);
  let start = Math.min(index, chars.length);
  let end = start;
  while (start > 0 && !isSpace(chars[start - 1])) {
    start--;
  }
  while (end < chars.length && !isSpace(chars[end])) {
    end++;
  }
  return clean(chars.slice(start, end).join(''));
}

function clean(word: string): Nullable<string> {
  const result = word.replace(TRIM, '').trim();
  return result.length > 0 ? result : null;
}

function caretAtPoint(x: number, y: number): Nullable<{ node: Node, offset: number }> {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node, offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}
