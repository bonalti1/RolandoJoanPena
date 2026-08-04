# South Texas Builders — Creator Landing Page

The TikTok creator funnel page. Creators post organic videos, and when
someone DMs them, they reply with the phone number and their personal link.
The link opens this page with the creator's own VSL on top and a $3,000
claim form below.

## The funnel

1. Creator posts organic TikTok content about STB.
2. Viewer DMs the creator → creator replies:
   *"You can call (956) 594-6936 or visit my link: yoursite.com/c/juan"*
3. The page greets them with "Juan Sent You 👋", plays Juan's vertical VSL,
   and shows the offer: **$1,500 toward blueprints + $1,500 upgrade credit**.
4. Visitor fills the claim form (name, phone, credit range, income range) →
   "Somebody from the team will contact you." A call button is right below
   for people who'd rather talk now.
5. Every lead arrives tagged with the creator's name, so you always know
   who to credit.

## Adding a creator

Open `creators.js` and add one entry:

```js
"juan": {
  name: "Juan",
  video: "https://www.youtube.com/watch?v=XXXXXXXX"
},
```

Their link is then `yoursite.com/c/juan` (also works as `yoursite.com/?c=juan`).
Video accepts YouTube, Vimeo, or a direct file (drop it in a `/video` folder
and use `/video/juan.mp4`). TikTok links can't be embedded — download the
video and host the file instead. Leave `video: ""` until it's recorded; the
page shows a friendly note instead of a broken player.

Creators should record **vertical (9:16)** — the player is phone-shaped.

## Leads (Netlify Forms)

The form posts to Netlify Forms — free, built into any Netlify deploy, no
setup needed. After the first deploy:

- View leads in the Netlify dashboard → **Forms** → `creator-claim`.
- Add email notifications: Site settings → Forms → Form notifications.

Each submission includes: name, phone, credit range, income range, and the
`creator` field (the slug from the link, or `direct` if they came without one).

## Deploy

Fully static. Drag and drop the `stb-creators` folder onto
https://app.netlify.com/drop — the included `_redirects` file makes the
`/c/creator-name` links work. Deploy it as its own Netlify site, separate
from the main landing page.
