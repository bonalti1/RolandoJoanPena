// ============================================================
//  CREATOR SETUP — this is the only file you edit per creator.
//
//  Each creator gets a link like:   yoursite.com/c/juan
//  (the part after /c/ must match a key below, lowercase)
//
//  For each creator set:
//    name  — how their name shows on the page ("Juan sent you!")
//    video — their VSL link. Works with:
//             • TikTok/IG won't embed — download the video and use a file,
//               YouTube, or Vimeo link instead:
//             • YouTube:  "https://www.youtube.com/watch?v=XXXXXXXX"
//             • Vimeo:    "https://vimeo.com/123456789"
//             • A file:   put it in /video and use "/video/juan.mp4"
//    Leave video as "" until it's recorded — the page shows a
//    "video coming soon" note instead of a broken player.
// ============================================================

window.CREATORS = {
  // Example creators — replace with your real ones:
  "juan": {
    name: "Juan",
    video: ""
  },
  "maria": {
    name: "Maria",
    video: ""
  }
};

// Shown when someone opens the page without a creator link
// (or with a link that doesn't match any creator above).
window.CREATOR_DEFAULT = {
  name: "",
  video: ""
};
