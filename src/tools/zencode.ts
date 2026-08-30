/**
 * ZenCode — HTML abbreviation expander.
 *
 * Wraps the lightweight `zen-coding` library (a.k.a. zen coding / Emmet-style
 * CSS-selector-to-HTML expansion) so S-AI agents can turn compact abbreviations
 * like `div#page>ul>li*3>a` into full HTML markup.
 *
 * Example abbreviations:
 *   - `div>a`                    → `<div><a href=""></a></div>`
 *   - `ul#nav>li.item$*3>a`      → ordered, numbered list items
 *   - `div#page>header+section+footer` → sibling layout
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type ZenCodeExpander = (abbreviation: string) => string;

let expander: ZenCodeExpander | null = null;

function getExpander(): ZenCodeExpander {
  if (expander) return expander;
  try {
    expander = require('zen-coding') as ZenCodeExpander;
  } catch {
    throw new Error(
      'ZenCode engine (`zen-coding`) is not installed. Run: npm install zen-coding'
    );
  }
  return expander;
}

/**
 * Expand a Zen Coding / Emmet-style abbreviation into HTML.
 * Returns the expanded markup, or null when the engine is unavailable.
 */
export function expandAbbreviation(abbreviation: string): string | null {
  if (!abbreviation || typeof abbreviation !== 'string') return null;
  try {
    const result = getExpander()(abbreviation);
    return typeof result === 'string' ? result : null;
  } catch {
    return null;
  }
}

export interface ZenCodeResult {
  html: string;
  abbreviation: string;
}
