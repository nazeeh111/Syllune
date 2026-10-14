import { compare, derivative } from './engine.js';
export const TOPICS = {
  linear: 'Linear equations',
  quadratic: 'Quadratic roots',
  expand: 'Expand & simplify',
  fractions: 'Fraction fluency',
  derivative: 'Polynomial derivatives',
};
export function makeProblem(topic, seed = Math.floor(Math.random() * 1e9)) {
  const a = 2 + (seed % 7),
    b = 1 + (Math.floor(seed / 7) % 9),
    c = 1 + (Math.floor(seed / 63) % 8);
  let prompt, answer, hints, explanation, base;
  if (topic === 'linear') {
    base = `${a}x + ${b} = ${a * c + b}`;
    prompt = `Solve ${base}`;
    answer = `x=${c}`;
    hints = [
      `Subtract ${b} from both sides.`,
      `You now have ${a}x = ${a * c}. Divide both sides by ${a}.`,
    ];
    explanation = `Subtract ${b}: ${a}x = ${a * c}. Divide by ${a}: x = ${c}. Substitute to confirm ${a} × ${c} + ${b} = ${a * c + b}.`;
  } else if (topic === 'quadratic') {
    base = `x^2 = ${a * a}`;
    prompt = `Find all real solutions: ${base}`;
    answer = `x=-${a} or x=${a}`;
    hints = [
      'Both a positive and a negative number can have the same square.',
      `Keep both roots: x = −${a} or x = ${a}.`,
    ];
    explanation = `${a}² and (−${a})² both equal ${a * a}. The complete real solution set is {−${a}, ${a}}.`;
  } else if (topic === 'expand') {
    base = `(x+${b})(x+${c})`;
    prompt = `Expand ${base}`;
    answer = `x^2+${b + c}x+${b * c}`;
    hints = [
      'Multiply each term in the first parenthesis by each term in the second.',
      `The two x terms combine to ${b + c}x.`,
    ];
    explanation = `x² + ${c}x + ${b}x + ${b * c} = x² + ${b + c}x + ${b * c}.`;
  } else if (topic === 'fractions') {
    base = `1/${a}+1/${a * 2}`;
    prompt = `Simplify ${base}`;
    answer = `3/${a * 2}`;
    hints = [
      `Use the common denominator ${a * 2}.`,
      `1/${a} = 2/${a * 2}. Add the numerators.`,
    ];
    explanation = `2/${a * 2} + 1/${a * 2} = 3/${a * 2}. An equivalent reduced fraction is accepted.`;
  } else if (topic === 'derivative') {
    const power = 2 + (Math.floor(seed / 63) % 7);
    const p = `${a}x^${power}+${b}x`;
    base = `d/dx(${p})`;
    prompt = `Differentiate ${p}`;
    answer = derivative(p);
    hints = [
      'Use the power rule: d/dx(kx^n) = knx^(n−1).',
      `The first coefficient becomes ${a * power}; the derivative of ${b}x is ${b}.`,
    ];
    explanation = `Apply the power rule to each term: ${answer}.`;
  } else throw Error('Choose a supported practice topic.');
  return {
    id: `${topic}:${seed}`,
    topic,
    prompt,
    base,
    answer,
    hints,
    explanation,
  };
}
export function gradeAnswer(p, input) {
  let s = input.trim();
  if (s.length > 600)
    return {
      status: 'unverified',
      detail: 'Keep your answer under 600 characters.',
    };
  if (['linear', 'quadratic'].includes(p.topic) && !s.includes('='))
    s = `x=${s}`;
  return compare(p.answer, s);
}
export function scheduleReview(level, correct, now = Date.now()) {
  const next = correct ? Math.min(5, level + 1) : 0;
  const days = [1, 1, 3, 7, 14, 30][next];
  return { level: next, due: now + days * 86400000 };
}
