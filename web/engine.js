// Exact checks within a deliberately bounded real algebra language. No eval.
const LIMIT_DEGREE = 8;
const LIMIT_LINE_LENGTH = 10_240;
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
};
class Q {
  constructor(n, d = 1n) {
    if (!d) throw Error('Division by zero is undefined.');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
    if (this.n.toString().length > 160 || this.d.toString().length > 160)
      throw Error('This calculation exceeds the exact-check size limit.');
  }
  add(b) {
    return new Q(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  mul(b) {
    return new Q(this.n * b.n, this.d * b.d);
  }
  neg() {
    return new Q(-this.n, this.d);
  }
  div(b) {
    return new Q(this.n * b.d, this.d * b.n);
  }
  eq(b) {
    return this.n === b.n && this.d === b.d;
  }
  str() {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }
}
const ZERO = new Q(0n),
  ONE = new Q(1n);
const trim = (p) => {
  while (p.length > 1 && !p.at(-1).n) p.pop();
  return p;
};
const add = (a, b) =>
  trim(
    Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
      (a[i] || ZERO).add(b[i] || ZERO),
    ),
  );
const neg = (a) => a.map((q) => q.neg());
const isZero = (p) => p.length === 1 && !p[0].n;
function mul(a, b) {
  if (isZero(a) || isZero(b)) return [ZERO];
  if (a.length + b.length - 2 > LIMIT_DEGREE)
    throw Error('Polynomials up to degree 8 are supported.');
  const c = Array(a.length + b.length - 1).fill(ZERO);
  a.forEach((x, i) =>
    b.forEach((y, j) => {
      c[i + j] = c[i + j].add(x.mul(y));
    }),
  );
  return trim(c);
}
const equal = (a, b) => a.length === b.length && a.every((q, i) => q.eq(b[i]));
function normalize(s) {
  return s
    .replace(/X/g, 'x')
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .trim();
}
// Keep exclusions independently of the fraction so cancellation, zero products,
// and zero powers cannot make a previously undefined input legal.
function fraction(numerator, denominator = [ONE], excluded = new Set()) {
  if (denominator.length === 1 && !denominator[0].eq(ONE)) {
    numerator = numerator.map((q) => q.div(denominator[0]));
    denominator = [ONE];
  }
  return { numerator, denominator, excluded };
}
const unite = (a, b) => new Set([...a, ...b]);
const opposite = (a) => fraction(neg(a.numerator), a.denominator, a.excluded);
function sumFractions(a, b) {
  const excluded = unite(a.excluded, b.excluded);
  if (equal(a.denominator, b.denominator))
    return fraction(add(a.numerator, b.numerator), a.denominator, excluded);
  return fraction(
    add(mul(a.numerator, b.denominator), mul(b.numerator, a.denominator)),
    mul(a.denominator, b.denominator),
    excluded,
  );
}
function multiplyFractions(a, b) {
  return fraction(
    mul(a.numerator, b.numerator),
    mul(a.denominator, b.denominator),
    unite(a.excluded, b.excluded),
  );
}
function divideFractions(a, b, polynomialOnly) {
  if (isZero(b.numerator)) throw Error('Division by zero is undefined.');
  if (b.numerator.length > 1 && polynomialOnly)
    throw Error('Polynomial derivatives require constant denominators.');
  if (b.numerator.length > 3)
    throw Error('Divisors can have a numerator of at most degree 2.');
  const zeros = roots(b.numerator);
  return fraction(
    mul(a.numerator, b.denominator),
    mul(a.denominator, b.numerator),
    unite(unite(a.excluded, b.excluded), zeros.values),
  );
}

function parseFraction(input, polynomialOnly = false) {
  const source = normalize(input);
  if (!source || source.length > 600)
    throw Error('Use an expression between 1 and 600 characters.');
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[x()+\-*/^]|\S/g) || [];
  if (tokens.length > 200) throw Error('This expression has too many terms.');
  let i = 0,
    depth = 0;
  const atom = () => {
    if (++depth > 24) throw Error('This expression is nested too deeply.');
    let result,
      t = tokens[i++];
    if (t === '(') {
      result = sum();
      if (tokens[i++] !== ')') throw Error('Close every parenthesis.');
    } else if (t === 'x') {
      result = fraction([ZERO, ONE]);
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t || '')) {
      if (t.length > 20) throw Error('Use numbers with at most 20 digits.');
      const [whole = '', frac = ''] = t.split('.');
      result = fraction([
        new Q(BigInt((whole || '0') + frac), 10n ** BigInt(frac.length)),
      ]);
    } else
      throw Error(
        'Supported: numbers, x, +, -, *, /, parentheses and powers 0–8.',
      );
    depth--;
    return result;
  };
  const power = () => {
    let a = atom();
    if (tokens[i] === '^') {
      i++;
      const t = tokens[i++];
      if (!/^\d+$/.test(t || '') || Number(t) > 8)
        throw Error('Powers must be whole numbers from 0 to 8.');
      let p = fraction([ONE], [ONE], a.excluded);
      for (let n = 0; n < Number(t); n++) p = multiplyFractions(p, a);
      a = p;
    }
    return a;
  };
  const unary = () => {
    if (tokens[i] === '+') {
      i++;
      return unaryBound();
    }
    if (tokens[i] === '-') {
      i++;
      return opposite(unaryBound());
    }
    return power();
  };
  const unaryBound = () => {
    if (++depth > 24) throw Error('Too many nested signs.');
    const p = unary();
    depth--;
    return p;
  };
  const product = () => {
    let a = unary();
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === '*' || t === '/') {
        i++;
        const b = unary();
        a = t === '/'
          ? divideFractions(a, b, polynomialOnly)
          : multiplyFractions(a, b);
      } else if (t === 'x' || t === '(') {
        a = multiplyFractions(a, unary());
      } else break;
    }
    return a;
  };
  const sum = () => {
    let a = product();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++],
        b = product();
      a = sumFractions(a, op === '-' ? opposite(b) : b);
    }
    return a;
  };
  const p = sum();
  if (i !== tokens.length)
    throw Error(
      'That notation is not supported. Try one expression or equation per line.',
    );
  return p;
}
export function parsePolynomial(input) {
  return parseFraction(input, true).numerator;
}
function format(p) {
  let s = '';
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    if (!q.n) continue;
    const minus = q.n < 0n;
    const magnitude = minus ? q.neg() : q;
    const coeff = i && magnitude.eq(ONE) ? '' : magnitude.str();
    const term = coeff + (i ? `x${i > 1 ? '^' + i : ''}` : '');
    s += (s ? (minus ? ' - ' : ' + ') : minus ? '-' : '') + term;
  }
  return s || '0';
}
function differentiate(p) {
  return p.length === 1
    ? [ZERO]
    : p.slice(1).map((q, i) => q.mul(new Q(BigInt(i + 1))));
}
export const derivative = (s) => format(differentiate(parsePolynomial(s)));
function expression(s) {
  const d = normalize(s).match(/^d\/dx\((.*)\)$/);
  return d
    ? fraction(differentiate(parsePolynomial(d[1])))
    : parseFraction(s);
}
function isqrt(n) {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let a = n,
    b = (a + 1n) / 2n;
  while (b < a) {
    a = b;
    b = (a + n / a) / 2n;
  }
  return a * a === n ? a : null;
}
function roots(p) {
  if (p.length === 1) return { kind: p[0].n ? 'finite' : 'all', values: [] };
  if (p.length === 2)
    return { kind: 'finite', values: [p[0].neg().div(p[1]).str()] };
  if (p.length > 3) return { kind: 'higher', polynomial: p };
  const [c, b, a] = p,
    disc = b.mul(b).add(new Q(-4n).mul(a).mul(c));
  if (disc.n < 0n) return { kind: 'finite', values: [] };
  const sn = isqrt(disc.n),
    sd = isqrt(disc.d);
  if (sn !== null && sd !== null) {
    const root = new Q(sn, sd),
      den = new Q(2n).mul(a);
    return {
      kind: 'finite',
      values: [
        ...new Set([
          b.neg().add(root).div(den).str(),
          b.neg().add(root.neg()).div(den).str(),
        ]),
      ].sort(),
    };
  }
  // Over Q, sharing one irrational quadratic root implies sharing its conjugate.
  return {
    kind: 'finite',
    values: ['quadratic:' + p.map((q) => q.div(a).str()).join(',')],
  };
}
// Match the keyword, using fixed-width checks for its surrounding whitespace.
const RESTRICTION = /(?<=\s)where(?=\s)/i;
const ALTERNATIVE = /(?<=\s)or(?=\s)/i;
const EXACT_LITERAL = /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*\/\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+))?\s*$/;
function readLine(input) {
  if (input.length > LIMIT_LINE_LENGTH)
    throw Error('This line exceeds the 10,240-character limit.');
  const [body, condition, extra] = input.split(RESTRICTION, 3);
  const excluded = new Set();
  if (condition !== undefined) {
    const match = normalize(condition).match(/^x\s*(?:!=|≠)\s*(.+)$/);
    if (!match || extra !== undefined)
      throw Error('Write restrictions as “where x != 1, -2”.');
    const items = match[1].split(',');
    if (items.length > 8) throw Error('Use at most 8 explicit exclusions.');
    for (const item of items) {
      if (!EXACT_LITERAL.test(item))
        throw Error('Use a decimal or a fraction for each explicit exclusion.');
      excluded.add(parsePolynomial(item)[0].str());
    }
  }
  if (!body.includes('=')) {
    const value = expression(body);
    return { ...value, excluded: unite(value.excluded, excluded) };
  }
  return { solution: equation(body, excluded) };
}
const without = (a, b) => [...a].filter((value) => !b.has(value));
function equation(s, lineExclusions) {
  const parts = s.split(ALTERNATIVE, 9);
  if (parts.length > 8) throw Error('Use at most 8 alternatives.');
  const solutions = new Set();
  let identityExclusions = null;
  for (const part of parts) {
    const sides = part.split('=');
    if (sides.length !== 2 || !sides.every((v) => v.trim()))
      throw Error('Use exactly one equals sign in each equation.');
    const difference = sumFractions(
      expression(sides[0]), opposite(expression(sides[1])),
    );
    const excluded = unite(difference.excluded, lineExclusions);
    const r = roots(difference.numerator);
    if (r.kind === 'higher') {
      if (parts.length > 1)
        throw Error('Alternative solutions support equations through degree 2.');
      if (excluded.size)
        throw Error('Equations with domain exclusions are checked through degree 2.');
      return r;
    }
    if (r.kind === 'all') {
      identityExclusions = identityExclusions === null
        ? excluded
        : new Set([...identityExclusions].filter((value) => excluded.has(value)));
    } else {
      for (const value of without(r.values, excluded)) solutions.add(value);
    }
  }
  return identityExclusions === null
    ? { kind: 'finite', values: [...solutions].sort() }
    : { kind: 'all', values: without(identityExclusions, solutions).sort() };
}
const proportional = (a, b) =>
  a.length === b.length &&
  equal(
    a.map((q) => q.div(a.at(-1))),
    b.map((q) => q.div(b.at(-1))),
  );
export function compare(before, after) {
  try {
    const a = readLine(before),
      b = readLine(after);
    if (Boolean(a.solution) !== Boolean(b.solution))
      throw Error('Keep both lines as equations, or both as expressions.');
    const eq1 = Boolean(a.solution);
    let ok, sameDomain = true;
    if (eq1) {
      const left = a.solution, right = b.solution;
      if (left.kind === 'higher' || right.kind === 'higher') {
        if (
          left.kind === 'higher' &&
          right.kind === 'higher' &&
          proportional(left.polynomial, right.polynomial)
        )
          ok = true;
        else
          throw Error(
            'Nonproportional equations above degree 2 need a broader solver.',
          );
      } else
        ok =
          left.kind === right.kind &&
          JSON.stringify(left.values) === JSON.stringify(right.values);
    } else {
      sameDomain = a.excluded.size === b.excluded.size
        && !without(a.excluded, b.excluded).length;
      ok = sameDomain && (equal(a.denominator, b.denominator)
        ? equal(a.numerator, b.numerator)
        : equal(
          mul(a.numerator, b.denominator), mul(b.numerator, a.denominator),
        ));
    }
    return {
      status: ok ? 'correct' : 'incorrect',
      title: ok ? 'This step holds.' : 'This step changes the result.',
      detail: ok
        ? eq1
          ? 'Both lines have the same real solution set.'
          : 'Both expressions have the same real domain and agree exactly on it.'
        : eq1
          ? 'The real solution set changed. Check signs, both sides, and whether any solutions were added or lost.'
          : sameDomain
            ? 'The expressions are not equal. Check distribution, coefficients and arithmetic.'
            : 'The real domain changed. Keep the original divisor or carry forward rational exclusions with “where x != 1”.',
      hint: sameDomain
        ? hint(before.split(RESTRICTION, 1)[0], after.split(RESTRICTION, 1)[0])
        : 'Find the values that make each original denominator zero.',
    };
  } catch (e) {
    return {
      status: 'unverified',
      title: 'Let’s review this notation.',
      detail: e.message,
      hint: 'A line outside the checker’s scope is left unverified. You can still keep writing.',
    };
  }
}
function hint(a, b) {
  if (a.includes('^2') && b.includes('=') && !b.includes('or'))
    return 'A squared equation can have two roots. Did you keep both?';
  if (a.includes('('))
    return 'Distribute to every term inside the parentheses.';
  if (a.includes('='))
    return 'Apply the same operation to both sides, then recheck the signs.';
  return 'Combine like terms and keep fraction arithmetic exact.';
}
export function checkWork(text) {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length > 80)
    return {
      steps: [],
      firstIssue: 0,
      error: 'Check at most 80 lines at a time.',
    };
  let issue = null;
  const steps = lines.map((line, i) => {
    if (!i) {
      try {
        readLine(line);
        return {
          line,
          status: 'start',
          title: 'Starting line',
          detail: 'This is your starting point, not a checked answer.',
        };
      } catch (e) {
        issue = 0;
        return {
          line,
          status: 'unverified',
          title: 'Starting line needs review',
          detail: e.message,
        };
      }
    }
    if (issue !== null)
      return {
        line,
        status: 'blocked',
        title: 'Review the earlier step first.',
        detail:
          'Later steps are kept, but are not verified against an unresolved chain.',
      };
    const r = compare(lines[i - 1], line);
    if (r.status !== 'correct') issue = i;
    return { line, ...r };
  });
  return { steps, firstIssue: issue };
}
