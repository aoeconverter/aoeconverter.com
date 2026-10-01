// npm run validate [-- --base origin/master] [--offline]
// Checks every file in src/data/conferences. With --base, files added since that ref must
// contain only upcoming deadlines. Prints GitHub annotations when running in Actions.
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { annotation, validateAll, type DataFile, type Problem } from './lib/conferences';

const DIR = 'src/data/conferences';
const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined;
const offline = args.includes('--offline');
const inCI = !!process.env.GITHUB_ACTIONS;

function changedStatus(): Map<string, 'added' | 'modified'> {
  const out = new Map<string, 'added' | 'modified'>();
  if (!base) return out;
  const diff = execFileSync('git', ['diff', '--name-status', '--no-renames', `${base}...HEAD`, '--', DIR], { encoding: 'utf8' });
  for (const line of diff.split('\n').filter(Boolean)) {
    const [status, path] = line.split('\t');
    if (status === 'A') out.set(path, 'added');
    else if (status === 'M') out.set(path, 'modified');
  }
  return out;
}

const status = changedStatus();
const files: DataFile[] = readdirSync(DIR)
  .filter((f) => !f.startsWith('.'))
  .map((f) => {
    const path = `${DIR}/${f}`;
    return { path, content: readFileSync(path, 'utf8'), status: status.get(path) ?? (base ? 'unchanged' : undefined) };
  });

const report = validateAll(files, Date.now());

// Link checks only for files this change touches, so one dead site doesn't block every PR.
if (!offline) {
  for (const [path, conf] of report.conferences) {
    if (base && !status.has(path)) continue;
    try {
      const res = await fetch(conf.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(10_000) });
      if (res.status >= 400 && res.status !== 405 && res.status !== 403) {
        report.warnings.push({ file: path, message: `The CFP link answered HTTP ${res.status}. Check that it's right.` });
      }
    } catch {
      report.warnings.push({ file: path, message: `Couldn't reach the CFP link ${conf.url}. Check that it's right.` });
    }
  }
}

const print = (level: 'error' | 'warning', p: Problem) =>
  console.log(inCI ? annotation(level, p) : `${level.toUpperCase()} ${p.file}${p.line ? ':' + p.line : ''}  ${p.message}`);
report.warnings.forEach((w) => print('warning', w));
report.errors.forEach((e) => print('error', e));

console.log(
  `\n${files.length} conference file(s), ${report.errors.length} error(s), ${report.warnings.length} warning(s).`,
);
process.exit(report.errors.length ? 1 : 0);
