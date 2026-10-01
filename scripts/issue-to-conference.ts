// Run by .github/workflows/issue-to-pr.yml. Reads the triggering issue from $GITHUB_EVENT_PATH,
// writes src/data/conferences/<slug>.yaml when the submission is valid, and reports back through
// $GITHUB_OUTPUT plus a Markdown file for the issue comment. Issue text is untrusted: it only
// ever reaches disk through the YAML serializer, and the slug is restricted to [a-z0-9-].
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { issueToConference } from './lib/conferences';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, 'utf8'));
const issue = event.issue as { number: number; body: string | null; user: { login: string; id: number } };
const outFile = process.env.GITHUB_OUTPUT!;
const commentFile = join(process.env.RUNNER_TEMP ?? '.', 'issue-comment.md');
const out = (k: string, v: string) => appendFileSync(outFile, `${k}=${v.replace(/[\r\n]/g, ' ')}\n`);

const result = issueToConference(issue.body ?? '', Date.now());
const path = result.slug ? `src/data/conferences/${result.slug}.yaml` : '';

if (result.ok && existsSync(path)) {
  result.ok = false;
  result.errors = [
    `There's already a file for this conference (\`${path}\`). To change its dates, use the "Report a wrong date" form instead.`,
  ];
}

if (!result.ok) {
  out('valid', 'false');
  writeFileSync(
    commentFile,
    [
      'Thanks for the submission! I couldn’t turn it into a pull request yet:',
      '',
      ...result.errors.map((e) => `- ${e}`),
      '',
      'Edit this issue to fix the details and I’ll try again automatically.',
    ].join('\n'),
  );
} else {
  writeFileSync(path, result.yaml!);
  const c = result.conference!;
  out('valid', 'true');
  out('slug', result.slug!);
  out('file', path);
  out('title', `Add ${c.name}`);
  out('author', `${issue.user.login} <${issue.user.id}+${issue.user.login}@users.noreply.github.com>`);
  writeFileSync(
    commentFile,
    [
      `Added from #${issue.number}, submitted by @${issue.user.login}.`,
      '',
      `**${c.name}**, ${c.field}`,
      `CFP: ${c.url}`,
      '',
      '| Track | Date | Time (AoE) |',
      '|---|---|---|',
      ...c.deadlines.map((d) => `| ${d.track.replace(/\|/g, '\\|')} | ${d.date} | ${d.time ?? '23:59'} |`),
      '',
      `Closes #${issue.number}`,
    ].join('\n'),
  );
}
out('comment', commentFile);
