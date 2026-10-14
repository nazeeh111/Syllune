# Checking guide

A verdict compares a transition, not an entire mathematical argument. The starting line is explicitly unverified as a problem statement. Once a line fails or falls outside scope, downstream steps are kept but blocked from green checks until the earlier issue is resolved.

## Language

Use decimal numbers, fractions, x or X, +, -, *, /, parentheses, and integer powers 0–8. Multiplication can be implicit, as in 2x or 2(x+1). Unary minus follows mathematical precedence: -x^2 means -(x^2). Unicode minus, multiplication, division and superscript 2/3 are normalized. Use one step per line. A derivative expression is written d/dx(polynomial).

Decimals become exact fractions. Polynomial coefficients use reduced BigInt rational arithmetic. Division must have a nonzero constant polynomial denominator. A denominator containing x stays unverified because domain exclusions could otherwise disappear. Negative, fractional or chained powers are outside scope.

## Expressions

Two supported expressions are correct when their exact coefficient vectors match after expansion. There is no random sampling and no floating-point tolerance. Expression equality does not mean a homework prompt has been answered.

## Equations

Linear and quadratic equations are compared by their complete real solution sets. Exact rational roots are reduced fractions. Irrational quadratic pairs use a normalized polynomial identity. Repeated quadratic roots can match linear equations. Equations with no real solutions are equivalent as real solution sets; the checker is not operating over complex numbers.

Use “or” with spaces for alternatives: x=-2 or x=2. Every branch is validated, including branches after an identity. An identity has all real solutions. A contradiction has no real solutions.

For degree 3–8, only proportional polynomial equations are verified. Other transformations stay unverified even when a more powerful solver could establish equivalence. Inequalities, variable denominators, systems, arbitrary functions and general calculus are outside this release’s checker.

## Recognition

Apple Vision returns candidates and bounding boxes from an image of the current page. Syllune never treats OCR confidence as a math verdict. Manual recognition presents editable text and requires a separate check action. Quiet reads may flag a possible issue in OCR-derived ink regions; those flags remain suggestions until you review the reading. Quiet reads never replace your existing transcript automatically. Images and ink remain unchanged. Uppercase X is accepted as x; inspect possible multiplication, signs, superscripts and split lines yourself.

## Bounds

Maximum 80 nonempty lines per check; 600 characters and 200 tokens per expression; 24 nested levels; powers 0–8; 20-character numeric tokens; rational numerator/denominator length 160 digits; at most 8 alternative equations. Outside these bounds, checks stay unverified rather than executing an unbounded expression. There is no eval or generated executable math code.

## Broader explanations

The optional local tutor can discuss math beyond this exact language. Its model-generated guidance is explicitly unverified and never changes a checker verdict. For example, a chain-rule explanation is advice to inspect, not a symbolic proof. Review both recognition and reasoning before relying on it.
