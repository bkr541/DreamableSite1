import { describe, expect, it } from 'vitest';
import { filterOptions, type SearchSelectOption } from '@/lib/searchFilter';

const opts: SearchSelectOption[] = [
  { value: '1', label: 'Acme Inc.', description: 'jane@acme.com' },
  { value: '2', label: 'Inbound Owl', description: 'dan@inbouldowl.com' },
  { value: '3', label: 'José Café', description: 'jose@cafe.co' },
  { value: '4', label: 'Photon Plasma, LLC.' },
  { value: '5', label: 'Nacme Labs' },
];
const values = (q: string) => filterOptions(opts, q).map((o) => o.value);

describe('search-as-you-type matching', () => {
  it('shows everything for an empty or blank query', () => {
    expect(values('')).toEqual(['1', '2', '3', '4', '5']);
    expect(values('   ')).toEqual(['1', '2', '3', '4', '5']);
  });
  it('matches anywhere in the label, ignoring case', () => {
    expect(values('OWL')).toEqual(['2']);
    expect(values('photon')).toEqual(['4']);
  });
  it('also searches the description (e.g. the email)', () => {
    expect(values('jane@')).toEqual(['1']);
    expect(values('cafe.co')).toEqual(['3']);
  });
  it('requires every typed word, in any order', () => {
    expect(values('inc acme')).toEqual(['1']);
    expect(values('owl zzz')).toEqual([]);
  });
  it('ignores accents both ways', () => {
    expect(values('jose cafe')).toEqual(['3']);
    expect(values('josé')).toEqual(['3']);
  });
  it('puts matches at the start of the name before matches in the middle, otherwise keeps order', () => {
    expect(values('acme')).toEqual(['1', '5']);
  });
  it('returns nothing when nothing matches', () => {
    expect(values('qwerty')).toEqual([]);
  });
});
