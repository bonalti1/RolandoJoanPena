# South Texas Builders — Landing Page

A single-page landing site for South Texas Builders: VSL on top, client
closings, homes gallery, and the team — using the same STB brand colors,
fonts, and logos as the closer presentation.

## Deploy (Netlify)

This folder is fully static and self-contained. Drag and drop the
`stb-landing` folder onto https://app.netlify.com/drop (same workflow as the
original STBCloserNetlify package), or point a Netlify site at this folder
with no build command and publish directory `stb-landing`.

## Adding your VSL video

Open `index.html`, find `var VSL_URL = "";` near the bottom, and paste your
video link between the quotes. Any of these work:

- YouTube: `https://www.youtube.com/watch?v=XXXXXXXX` (watch, share, or embed links)
- Vimeo: `https://vimeo.com/123456789`
- A direct file: put the file at `video/vsl.mp4` and use `/video/vsl.mp4`

Until a link is set, the play button shows a "video coming soon" note with
the phone number instead of a broken player.

## Sections

1. **Hero + VSL** — headline, red bar, trust badges (33+ years, 2nd gen, 100% custom)
2. **Client Closings** — six real signing/breaking-ground photos with captions
3. **Homes** — eight completed-home photos in a mosaic gallery
4. **Team** — founders photo (Israel & Javier Gonzalez) plus eight team headshots
5. **CTA + footer** — call/text buttons wired to (956) 594-6936
