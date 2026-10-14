import { useEffect, useRef } from 'react';

export const MAX_MATH_LENGTH = 2048;

export default function StudyMath({ latex, display = false, allowed = true }: { latex: string; display?: boolean; allowed?: boolean }) {
  const elementRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    let cancelled = false;
    const sourceText = `${display ? '$$' : '$'}${latex}${display ? '$$' : '$'}`;
    element.replaceChildren();
    element.textContent = sourceText;
    element.classList.add('material-math-fallback');
    if (!allowed || latex.length > MAX_MATH_LENGTH) {
      return () => { cancelled = true; element.replaceChildren(); };
    }
    // The large formula renderer is requested only when a formula is actually present.
    void import('katex').then(({ default: katex }) => {
      if (cancelled || elementRef.current !== element) return;
      element.classList.remove('material-math-fallback');
      // Only a delimited TeX expression reaches KaTeX. Model-provided HTML never does.
      katex.render(latex, element, {
        displayMode: display,
        output: 'htmlAndMathml',
        trust: false,
        throwOnError: false,
        strict: 'error',
        maxExpand: 100,
        maxSize: 10,
        globalGroup: false,
        macros: {},
        errorColor: '#6d7888',
      });
    }).catch(() => {
      if (cancelled || elementRef.current !== element) return;
      // Error strings may contain input; the fallback is always a DOM text node.
      element.textContent = sourceText;
      element.classList.add('material-math-fallback');
    });
    return () => { cancelled = true; element.replaceChildren(); };
  }, [latex, display, allowed]);
  return <span ref={elementRef} className={`material-math ${display ? 'material-math-display' : 'material-math-inline'}`} />;
}
