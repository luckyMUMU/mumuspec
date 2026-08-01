import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/spec/inheritance.ts';
let content = readFileSync(path, 'utf-8');

// Fix: shallNotHasNegative should check shallNotLower for negative keywords
const before = content;
content = content.replace(
  "shallNotHasNegative = shallLower.includes('禁')",
  "shallNotHasNegative = shallNotLower.includes('禁')"
);
content = content.replace(
  "shallNotLower.includes('不得')",
  "shallNotLower.includes('不得')"
);
// Also fix the 'not' check
content = content.replace(
  "shallLower.includes('not')",
  "shallNotLower.includes('not')"
);

if (content !== before) {
  writeFileSync(path, content, 'utf-8');
  console.log('Fixed polarity check');
} else {
  console.log('No changes needed');
  const match = before.match(/shallNotHasNegative = .*/);
  if (match) console.log('Current:', match[0]);
}
