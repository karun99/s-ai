import { z } from 'zod';
import { expandAbbreviation } from '../../src/tools/zencode.js';

function register(mcp: any, skill: any): void {
  mcp.tool(
    'zencode_expand',
    'Expand a Zen Coding (Emmet-style) HTML abbreviation into markup. '
      + 'Supports > (child), + (sibling), * (multiply), # (id), . (class), [attr] (attributes), $ (numbering), and () (grouping). '
      + 'Examples: "div#page>ul>li.item$*3>a", "div.a>p*2", "section>h1+p".',
    { abbreviation: z.string().describe('The Zen Coding abbreviation to expand') },
    async ({ abbreviation }: { abbreviation: string }) => {
      const html = expandAbbreviation(abbreviation);
      if (html === null) {
        return { content: [{ type: 'text' as const, text: `Error: could not expand abbreviation: ${abbreviation}` }] };
      }
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ abbreviation, html }, null, 2) },
        ],
      };
    }
  );

  mcp.prompt(
    'zencode_layout',
    'Design an HTML layout using Zen Coding abbreviations',
    { goal: z.string().describe('What layout to build (e.g. "a blog page with nav, articles, sidebar and footer")').optional() },
    ({ goal }: { goal?: string }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: goal
              ? `Design an HTML layout for: ${goal}. Write it as a single-line Zen Coding abbreviation (using >, +, *, #, ., [attr]), then expand it with zencode_expand.`
              : 'Help me build an HTML layout using Zen Coding abbreviations. What page structure should I describe?',
          },
        },
      ],
    })
  );
}

export { register };
