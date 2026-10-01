export const REPO_URL = 'https://github.com/aoeconverter/aoeconverter.com';

export const addConferenceUrl = `${REPO_URL}/issues/new?template=add-conference.yml`;

export function fixDeadlineUrl(slug: string): string {
  return `${REPO_URL}/issues/new?${new URLSearchParams({ template: 'fix-deadline.yml', slug, title: `Wrong date: ${slug}` })}`;
}
