import { classifyConstraint, isRegexCheckable } from '../dist/spec/verifier-classify.js';
const text = '临时注入的不可验证占位约束 tc2 probe qzxkv';
console.log('isRegexCheckable:', isRegexCheckable(text));
const cls = classifyConstraint({
  requirement: 'T',
  polarity: 'shall-not',
  text,
  annotations: [],
  enforcement: [],
  source: 'debug',
});
console.log('cls:', cls);
