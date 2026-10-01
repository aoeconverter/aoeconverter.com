# Adding conference deadlines

Thanks for helping keep the list on [aoeconverter.com/conferences](https://aoeconverter.com/conferences) accurate. Every entry is reviewed before it goes live.

## The easy way: fill in a form

[Open the "Add a conference" form](https://github.com/aoeconverter/aoeconverter.com/issues/new?template=add-conference.yml). A bot checks your details and opens the pull request for you. If something's off, it comments on your issue; edit the issue and it tries again.

Dates wrong or extended? Use [Report a wrong date](https://github.com/aoeconverter/aoeconverter.com/issues/new?template=fix-deadline.yml), or the link next to each deadline on the site.

## The Git way: open a pull request

Each conference edition is one file in `src/data/conferences/`, named after the conference: `NeurIPS 2027` → `neurips-2027.yaml`.

```yaml
name: NeurIPS 2027
field: Machine learning
url: https://neurips.cc/Conferences/2027/CallForPapers
location: Vancouver, Canada        # optional
deadlines:
  - track: Abstracts
    date: 2027-05-10               # no time means 23:59 AoE
  - track: Full papers
    date: 2027-05-17
  - track: Supplementary material
    date: 2027-05-24
    time: "12:00"                  # AoE, in quotes
```

Rules (the `validate` check enforces them):

- `name` includes the edition year, and the file name is that name in lowercase with dashes.
- `field` is one of the values in [`src/data/fields.ts`](src/data/fields.ts). Need a new one? Open a separate PR that adds it there and to the issue form.
- `url` is the official call for papers (https), and that page states the deadlines.
- Only list deadlines given in AoE. Copy the time exactly as written; leave it out for 23:59.
- New files can't contain deadlines that have already passed.
- One conference edition per pull request.

Check your file before pushing:

```sh
npm install
npm run validate
```
