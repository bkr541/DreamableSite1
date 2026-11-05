// Matching for the search-as-you-type pick lists (components/dropdowns/SearchSelect.tsx).

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Second line in the list (e.g. an email address). Searched too. */
  description?: string;
}

/** Lower-case and strip accents, so "jose" finds "José". */
export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

/** Options matching what was typed: every word must appear in the label or description; matches at the start of the label come first. */
export function filterOptions(options: SearchSelectOption[], query: string): SearchSelectOption[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  const hits = options.filter((o) => {
    const hay = norm(`${o.label} ${o.description ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
  const starts = (o: SearchSelectOption) => (norm(o.label).startsWith(words[0]) ? 0 : 1);
  return hits.map((o, i) => ({ o, i })).sort((a, b) => starts(a.o) - starts(b.o) || a.i - b.i).map((x) => x.o);
}
