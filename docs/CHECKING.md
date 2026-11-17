# Checking guide

A verdict compares a transition, not an entire mathematical argument. The starting line is explicitly unverified as a problem statement. Once a line fails or falls outside scope, downstream steps are kept but blocked from green checks until the earlier issue is resolved.

The margin leads with the first line that needs review and counts how many transitions were verified and how many are waiting on that line. **Show checked working** opens the verified prefix and the starting-line note. **Edit step** selects the matching transcript line, including in notebooks with blank lines between steps. The check button and Ctrl / ⌘ + Enter move keyboard focus to the result. Quiet checks announce the summary while keeping focus where you are.

## Language

Use decimal numbers, fractions, x or X, +, -, *, /, parentheses, and integer powers 0–8. Multiplication can be implicit, as in 2x or 2(x+1). Unary minus follows mathematical precedence: -x^2 means -(x^2). Unicode minus, multiplication, division and superscript 2/3 are normalized. Use one step per line. A derivative expression is written d/dx(polynomial).

Decimals become exact fractions. Polynomial coefficients use reduced BigInt rational arithmetic. Division is exact. A divisor may have a numerator of degree at most 2, and its real zeros are excluded even when a later operation cancels the divisor. Derivatives continue to require polynomial inputs. Negative, fractional or chained powers are outside scope.

## Expressions

Two supported expressions must have the same real domain and the same values on it. Syllune compares exact polynomial coefficients after cross multiplication.

For example, `(x^2-1)/(x-1)` followed by `x+1` loses the exclusion at 1. Write `x+1 where x != 1` to carry the restriction forward. Use a comma-separated list for multiple exclusions, as in `where x != -1, 1/2`. Explicit exclusions accept exact decimals or fractions. To preserve irrational quadratic exclusions, keep a divisor with the same excluded roots on the new line.

There is no random sampling or floating-point tolerance. Expression equality does not mean a homework prompt has been answered.

## Equations

Linear and quadratic equations are compared by their complete real solution sets. Exact rational roots are reduced fractions. Irrational quadratic pairs use a normalized polynomial identity. Repeated quadratic roots can match linear equations. Equations with no real solutions are equivalent as real solution sets; the checker is not operating over complex numbers.

Use “or” with spaces for alternatives: x=-2 or x=2. Every branch is validated, including branches after an identity. An identity has all real solutions. A contradiction has no real solutions.

In a rational equation, Syllune finds roots of the exact numerator after subtracting the two sides and filters out undefined inputs. The same explicit `where x != ...` syntax applies to every alternative on the line. For example, going from `(x^2-1)/(x-1) = 0` to `x^2-1 = 0` introduces an invalid solution at 1. Use `x^2-1 = 0 where x != 1` or proceed to `x = -1`.

Syllune solves equations with exclusions through numerator degree 2. For degree 3–8 without exclusions, it verifies proportional equations. Other transformations stay unverified even when a more powerful solver could establish equivalence. Inequalities, systems, arbitrary functions and general calculus are outside the checker’s scope.

## Recognition

Apple Vision returns candidates and bounding boxes from an image of the current page. Syllune never treats OCR confidence as a math verdict. Manual recognition presents editable text and requires a separate check action. Quiet reads may flag a possible issue in OCR-derived ink regions; those flags remain suggestions until you review the reading. Quiet reads never replace your existing transcript automatically. Images and ink remain unchanged. Uppercase X is accepted as x; inspect possible multiplication, signs, superscripts and split lines yourself.

## Bounds

Maximum 80 nonempty lines per check, 10,240 characters per line; 600 characters and 200 tokens per expression; 24 nested levels; powers 0–8; 20-character numeric tokens; rational numerator/denominator length 160 digits; at most 8 alternative equations and 8 explicit exclusions. Every intermediate numerator and denominator, including cross products, must stay within degree 8. Outside these bounds, checks stay unverified rather than executing an unbounded expression. There is no eval or generated executable math code.

## Broader explanations

The optional local tutor can discuss math beyond this exact language. Its model-generated guidance is explicitly unverified and never changes a checker verdict. For example, a chain-rule explanation is advice to inspect, not a symbolic proof. Review both recognition and reasoning before relying on it.
