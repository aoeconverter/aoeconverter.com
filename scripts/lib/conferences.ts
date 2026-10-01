// Pure logic behind `npm run validate` and the issue-to-PR bot, kept free of I/O so it's testable.
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { deadlineEpoch } from '../../src/lib/aoe';
import { conferenceSchema, slugify, type Conference } from '../../src/data/schema';

export interface Problem {
  file: string;
  line?: number;
  message: string;
}

export interface DataFile {
  path: string; // e.g. src/data/conferences/neurips-2027.yaml
  content: string;
  status?: 'added' | 'modified' | 'unchanged';
}

export interface Report {
  errors: Problem[];
  warnings: Problem[];
  conferences: Map<string, Conference>;
}

const FILENAME = /^([a-z0-9-]+-\d{4})\.yaml$/;

const baseName = (p: string) => p.split('/').pop() ?? p;

/** 1-based line of the first occurrence of `needle`, for inline PR annotations. */
function lineOf(content: string, needle: string | undefined): number | undefined {
  if (!needle) return undefined;
  const i = content.indexOf(needle);
  return i < 0 ? undefined : content.slice(0, i).split('\n').length;
}

/** Validate one file in isolation: YAML syntax, schema, filename. */
export function checkFile(file: DataFile): { conference?: Conference; errors: Problem[] } {
  const errors: Problem[] = [];
  const name = baseName(file.path);
  const m = FILENAME.exec(name);
  if (!m) errors.push({ file: file.path, message: `File name must look like "neurips-2027.yaml" (lowercase, dashes, ending in the year).` });

  let raw: unknown;
  try {
    raw = parseYaml(file.content);
  } catch (e) {
    errors.push({ file: file.path, message: `Not valid YAML: ${(e as Error).message.split('\n')[0]}` });
    return { errors };
  }

  const parsed = conferenceSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.filter((p) => typeof p === 'string').pop() as string | undefined;
      const where = issue.path.join('.');
      errors.push({
        file: file.path,
        line: lineOf(file.content, key ? `${key}:` : undefined),
        message: where && !issue.message.startsWith(where) ? `${where}: ${issue.message}` : issue.message,
      });
    }
    return { errors };
  }

  const conf = parsed.data;
  if (m && slugify(conf.name) !== m[1]) {
    errors.push({
      file: file.path,
      line: lineOf(file.content, 'name:'),
      message: `File name doesn't match the conference name. Rename the file to "${slugify(conf.name)}.yaml".`,
    });
  }
  return { conference: conf, errors };
}

/** Validate the whole data directory, including cross-file and "is it new?" rules. */
export function validateAll(files: DataFile[], now: number): Report {
  const report: Report = { errors: [], warnings: [], conferences: new Map() };
  const byUrl = new Map<string, string>();

  for (const file of files) {
    const { conference, errors } = checkFile(file);
    report.errors.push(...errors);
    if (!conference) continue;
    report.conferences.set(file.path, conference);

    const other = byUrl.get(conference.url);
    if (other) {
      report.warnings.push({
        file: file.path,
        line: lineOf(file.content, 'url:'),
        message: `Same CFP link as ${baseName(other)}. If this is the same conference, merge the deadlines into one file.`,
      });
    } else {
      byUrl.set(conference.url, file.path);
    }

    for (const d of conference.deadlines) {
      const epoch = deadlineEpoch(d.date, d.time)!;
      if (epoch > now) continue;
      const problem = {
        file: file.path,
        line: lineOf(file.content, d.date),
        message: `The "${d.track}" deadline (${d.date} ${d.time ?? '23:59'} AoE) has already passed.`,
      };
      // New files must only contain upcoming deadlines; edits to older files may keep past ones.
      if (file.status === 'added') report.errors.push(problem);
      else if (file.status === 'modified') report.warnings.push(problem);
    }
  }
  return report;
}

/** GitHub Actions workflow-command annotation. */
export function annotation(level: 'error' | 'warning', p: Problem): string {
  const loc = [`file=${p.file}`, p.line ? `line=${p.line}` : ''].filter(Boolean).join(',');
  const msg = p.message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return `::${level} ${loc}::${msg}`;
}

// ---- Issue form → conference ---------------------------------------------------------------

/** Labels in .github/ISSUE_TEMPLATE/add-conference.yml. Changing one there means changing it here. */
export const ISSUE_LABELS = {
  name: 'Conference name and year',
  field: 'Field',
  url: 'Official call for papers',
  deadlines: 'Deadlines',
  location: 'Location',
} as const;

/** Split an issue-form body ("### Label\n\nvalue") into a label → value map. */
export function parseIssueForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = body.replace(/\r\n/g, '\n').split(/^###\s+(.+?)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const value = parts[i + 1].trim();
    out[parts[i]] = value === '_No response_' ? '' : value;
  }
  return out;
}

/** "Full papers, 2027-05-17, 12:00" → deadline object. Also accepts "|" or tabs, and a bare date. */
export function parseDeadlineLine(line: string): { track: string; date: string; time?: string } | string {
  const cells = line
    .replace(/^[-*]\s*/, '')
    .split(/\s*[,|\t]\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
  const dateIdx = cells.findIndex((c) => /^\d{4}-\d{2}-\d{2}$/.test(c));
  if (dateIdx < 0) return `"${line}" has no date in YYYY-MM-DD form.`;
  const date = cells[dateIdx];
  const time = cells.find((c, i) => i !== dateIdx && /^\d{1,2}:\d{2}$/.test(c));
  const track = cells.filter((c) => c !== date && c !== time).join(', ') || 'Submission';
  return time && time !== '23:59' ? { track, date, time } : { track, date };
}

export interface IssueResult {
  ok: boolean;
  slug?: string;
  yaml?: string;
  conference?: Conference;
  errors: string[];
}

/** Turn an issue-form body into a validated YAML file, or a list of human-readable errors. */
export function issueToConference(body: string, now: number): IssueResult {
  const form = parseIssueForm(body);
  const errors: string[] = [];
  const get = (k: keyof typeof ISSUE_LABELS) => (form[ISSUE_LABELS[k]] ?? '').trim();

  const deadlines = get('deadlines')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseDeadlineLine)
    .filter((d): d is Exclude<ReturnType<typeof parseDeadlineLine>, string> => {
      if (typeof d === 'string') errors.push(d);
      return typeof d !== 'string';
    });

  const candidate: Record<string, unknown> = {
    name: get('name').replace(/\s+/g, ' '),
    field: get('field'),
    url: get('url'),
    ...(get('location') ? { location: get('location') } : {}),
    deadlines,
  };
  // Checked here as well as in validateAll, which skips it when the schema already failed,
  // so the submitter sees every problem in one comment.
  for (const d of deadlines) {
    const epoch = deadlineEpoch(d.date, d.time);
    if (epoch !== null && epoch <= now) errors.push(`The "${d.track}" deadline (${d.date} ${d.time ?? '23:59'} AoE) has already passed.`);
  }
  const slug = slugify(String(candidate.name));
  // Quote times: YAML 1.1 parsers read a bare 12:00 as the number 720.
  const yaml = stringifyYaml(candidate, { lineWidth: 0 }).replace(/^(\s+time: )(\d{1,2}:\d{2})$/gm, '$1"$2"');
  const report = validateAll([{ path: `src/data/conferences/${slug}.yaml`, content: yaml }], now);
  errors.push(...report.errors.map((e) => e.message));

  if (errors.length) return { ok: false, errors };
  return { ok: true, slug, yaml, conference: report.conferences.values().next().value, errors: [] };
}
