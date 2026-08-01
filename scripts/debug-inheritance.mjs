import { parseSpecFile } from '../dist/spec/parser.js';
// Inline test the isConflicting function logic
const shall = "必须使用 HTTP 协议进行数据传输";
const shallNot = "禁止使用 HTTP 协议进行明文通信";

const shallLower = shall.toLowerCase();
const shallNotLower = shallNot.toLowerCase();

console.log('shallLower:', shallLower);
console.log('shallNotLower:', shallNotLower);

const shallHasPositive = shallLower.includes('must') || shallLower.includes('必须') || shallLower.includes('应该');
const shallNotHasNegative = shallNotLower.includes('禁') || shallNotLower.includes('not') || shallNotLower.includes('不得');

console.log('shallHasPositive:', shallHasPositive);
console.log('shallNotHasNegative:', shallNotHasNegative);

// Extract key terms
const stopWords = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'must', 'shall', 'should', 'may', 'not', '所有', '必须', '禁止',
  '不得', '不应', '应该', '可以', '使用', '在', '的', '和', '与',
]);

function extractKeyTerms(text) {
  const words = text.split(/[\s,，。.;；:：/\\]+/).filter((w) => w.length > 1 && !stopWords.has(w));
  return words;
}

const shallTerms = extractKeyTerms(shallLower);
const shallNotTerms = extractKeyTerms(shallNotLower);

console.log('shallTerms:', shallTerms);
console.log('shallNotTerms:', shallNotTerms);

const matchingTerms = shallTerms.filter((term) => shallNotTerms.includes(term));
console.log('matchingTerms:', matchingTerms);
console.log('conflict?', matchingTerms.length >= 2);
