# SecProbe project page (front-end)

Front-end of the SecProbe project page. The homepage is public and contains only information already
reported in the [paper](https://arxiv.org/abs/2609.33763): the project overview, method, aggregate findings
and citation. It does not fetch private task records or leaderboard files.

Task instructions, repository source, tests, analysis and evaluation/generation tools require read access
to the private content repository and the visitor's own GitHub sign-in. Private content is loaded at
runtime, never included in the public site build. This repository contains no benchmark data.

## Access requests

The public `#/access` page lets visitors request task details, research code and/or data. Requests are
reviewed manually by the authors; signing in does not grant access. By default, the request button opens
a prefilled GitHub issue for the visitor to review and submit. The page states that these issues are
public. It also links to the dataset's existing Hugging Face approval form when data is selected.

To use an author email address or a dedicated application form, set the repository Actions variable
`SECPROBE_ACCESS_REQUEST_URL` (for example, a `mailto:` URL). For local builds, use
`VITE_ACCESS_REQUEST_URL`. Email requests open a draft; HTTP form URLs receive `title` and `body` query
parameters, which the form can use for prefilling. No request is submitted by this site itself.

After approving a task-access request, the authors grant read access to `SECPROBE_DATA_REPO`
(default `Xiaonan-debug/secprobe-data`). The visitor accepts the GitHub invitation and signs in to open
protected pages. Research-code repositories and the Hugging Face dataset require their own access
grants; the authors share those with approved applicants. Keep the content, research-code and generated
task repositories private, and the Hugging Face dataset gated. The frontend gate complements those
service-side permissions.

`VITE_LOCAL_DATA=1` bypasses the gate for development fixtures only; never enable it for a public build
or put private content in `web/public`.

## Visual identity

The interface uses self-hosted Google Sans (400–700, normal and italic), with JetBrains Mono for code
and numeric annotations. Official font sources, licensing and trademark notes are in `web/public/fonts`.
The SecProbe mark is an editable SVG feedback loop used in the header, hero, footer and favicon.

The university strip identifies the paper authors' affiliations using official artwork on a white
surface in both themes. Asset source links are recorded in `web/public/affiliations/SOURCES.txt`.
