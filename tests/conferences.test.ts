import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  checkFile,
  issueToConference,
  ISSUE_LABELS,
  parseDeadlineLine,
  parseIssueForm,
  validateAll,
  annotation,
} from '../scripts/lib/conferences';
import { FIELDS } from '../src/data/fields';
import { slugify } from '../src/data/schema';

const NOW = Date.UTC(2026, 9, 1);
const dir = 'src/data/conferences';

const good = `name: Example Conf 2027
field: Machine learning
url: https://example.org/cfp
deadlines:
  - track: Abstracts
    date: 2027-05-10
  - track: Full papers
    date: 2027-05-17
    time: "12:00"
`;

describe('conference files', () => {
  it('accepts a well-formed file', () => {
    const r = checkFile({ path: `${dir}/example-conf-2027.yaml`, content: good });
    expect(r.errors).toEqual([]);
    expect(r.conference?.deadlines[1].time).toBe('12:00');
  });

  it('requires the file name to match the conference name', () => {
    const r = checkFile({ path: `${dir}/other-2027.yaml`, content: good });
    expect(r.errors[0].message).toContain('example-conf-2027.yaml');
    expect(checkFile({ path: `${dir}/Example.yaml`, content: good }).errors.length).toBeGreaterThan(0);
  });

  it('reports schema problems with a line number', () => {
    const bad = good.replace('Machine learning', 'Cooking').replace('2027-05-17', '2027-02-30');
    const r = checkFile({ path: `${dir}/example-conf-2027.yaml`, content: bad });
    const messages = r.errors.map((e) => e.message).join('\n');
    expect(messages).toContain('field must be one of');
    expect(messages).toContain('YYYY-MM-DD');
    expect(r.errors.find((e) => e.message.startsWith('field'))?.line).toBe(2);
  });

  it('rejects unquoted times, http links, unknown keys and names without a year', () => {
    const cases = [
      good.replace('"12:00"', '1200'),
      good.replace('https://', 'http://'),
      good + 'notes: hi\n',
      good.replace('Example Conf 2027', 'Example Conf'),
    ];
    for (const c of cases) expect(checkFile({ path: `${dir}/example-conf-2027.yaml`, content: c }).errors.length).toBeGreaterThan(0);
  });

  it('reports YAML syntax errors', () => {
    expect(checkFile({ path: `${dir}/x-2027.yaml`, content: 'name: [oops' }).errors[0].message).toContain('Not valid YAML');
  });

  it('only rejects past deadlines in newly added files', () => {
    const past = good.replace(/2027-05/g, '2026-05');
    const file = { path: `${dir}/example-conf-2027.yaml`, content: past };
    expect(validateAll([{ ...file, status: 'added' }], NOW).errors).toHaveLength(2);
    const modified = validateAll([{ ...file, status: 'modified' }], NOW);
    expect(modified.errors).toHaveLength(0);
    expect(modified.warnings).toHaveLength(2);
    expect(validateAll([{ ...file, status: 'unchanged' }], NOW).warnings).toHaveLength(0);
  });

  it('warns about two files with the same CFP link', () => {
    const other = good.replace('Example Conf 2027', 'Example Conf Workshop 2027');
    const r = validateAll(
      [
        { path: `${dir}/example-conf-2027.yaml`, content: good },
        { path: `${dir}/example-conf-workshop-2027.yaml`, content: other },
      ],
      NOW,
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings[0].message).toContain('Same CFP link');
  });

  it('formats GitHub annotations', () => {
    expect(annotation('error', { file: 'a.yaml', line: 3, message: '50% bad\nreally' })).toBe(
      '::error file=a.yaml,line=3::50%25 bad%0Areally',
    );
  });

  it('accepts the real data directory', () => {
    // Guards against committing a broken file without running the validator.
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => ({ path: `${dir}/${f}`, content: readFileSync(`${dir}/${f}`, 'utf8') }));
    expect(validateAll(files, NOW).errors).toEqual([]);
  });
});

describe('issue form', () => {
  const body = (o: Partial<Record<keyof typeof ISSUE_LABELS, string>>) =>
    (Object.keys(ISSUE_LABELS) as (keyof typeof ISSUE_LABELS)[])
      .map((k) => `### ${ISSUE_LABELS[k]}\n\n${o[k] ?? '_No response_'}`)
      .join('\n\n');

  const valid = {
    name: '  Example   Conf 2027 ',
    field: 'Machine learning',
    url: 'https://example.org/cfp',
    deadlines: 'Abstracts, 2027-05-10\r\n\r\n- Full papers | 2027-05-17 | 12:00\n2027-05-24',
  };

  it('parses issue-form sections', () => {
    expect(parseIssueForm('### A\n\nx\n\n### B\n\n_No response_\n')).toEqual({ A: 'x', B: '' });
  });

  it('parses deadline lines in several shapes', () => {
    expect(parseDeadlineLine('Abstracts, 2027-05-10')).toEqual({ track: 'Abstracts', date: '2027-05-10' });
    expect(parseDeadlineLine('Full papers | 2027-05-17 | 12:00')).toEqual({ track: 'Full papers', date: '2027-05-17', time: '12:00' });
    expect(parseDeadlineLine('2027-05-24, 23:59')).toEqual({ track: 'Submission', date: '2027-05-24' });
    expect(parseDeadlineLine('Camera ready, next May')).toContain('no date');
  });

  it('turns a valid submission into a YAML file that passes validation', () => {
    const r = issueToConference(body(valid), NOW);
    expect(r.errors).toEqual([]);
    expect(r.slug).toBe('example-conf-2027');
    const data = parse(r.yaml!);
    expect(data.name).toBe('Example Conf 2027');
    expect(data.deadlines).toHaveLength(3);
    expect(data.location).toBeUndefined();
    expect(r.yaml).toContain('time: "12:00"');
    expect(checkFile({ path: `${dir}/${r.slug}.yaml`, content: r.yaml! }).errors).toEqual([]);
  });

  it('explains every problem in a bad submission', () => {
    const r = issueToConference(body({ ...valid, url: 'example.org', deadlines: 'Abstracts, 2026-05-10\nsoon' }), NOW);
    expect(r.ok).toBe(false);
    const text = r.errors.join('\n');
    expect(text).toContain('no date');
    expect(text).toContain('url');
    expect(text).toContain('already passed');
    expect(text).not.toContain('File name');
  });

  it('keeps hostile text inert', () => {
    const r = issueToConference(body({ ...valid, name: 'Evil"; rm -rf / # ../../x 2027', location: 'a\nb: c' }), NOW);
    expect(r.slug).toMatch(/^[a-z0-9-]+$/);
    if (r.ok) expect(parse(r.yaml!).name).toBe('Evil"; rm -rf / # ../../x 2027');
  });

  it('matches the issue template', () => {
    const tpl = parse(readFileSync('.github/ISSUE_TEMPLATE/add-conference.yml', 'utf8'));
    const labels = tpl.body.filter((b: any) => b.type !== 'markdown').map((b: any) => b.attributes.label);
    expect(labels.sort()).toEqual(Object.values(ISSUE_LABELS).sort());
    const dropdown = tpl.body.find((b: any) => b.type === 'dropdown');
    expect(dropdown.attributes.options).toEqual([...FIELDS]);
  });

  it('slugifies names', () => {
    expect(slugify('ACM CHI 2027')).toBe('acm-chi-2027');
    expect(slugify('Ubicomp/ISWC & Co 2027')).toBe('ubicomp-iswc-and-co-2027');
    expect(slugify('Écoles d’été 2027')).toBe('ecoles-d-ete-2027');
  });
});
