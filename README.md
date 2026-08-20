# Digital Graveyard

A 3-page ASCII, black-and-white graveyard site. Visitors create a grave with a
name, dates, and an obituary; it's saved to a shared Firebase database and
appears as a tombstone in an explorable graveyard that every visitor sees.

Files:

- `index.html` — landing page with "Explore" / "Create a Grave" buttons
- `create.html` / `create.js` — the grave-creation form
- `explore.html` / `explore.js` — the walkable ASCII graveyard
- `style.css` — shared black & white styling
- `firebase-config.js` — **you fill this in** with your Firebase project keys
- `firebase-init.js` — sets up the shared Firebase/Firestore connection

Nothing will save or load until you complete the Firebase setup below —
until then, `explore.html` will show a banner explaining that.

---

## 1. Create a free Firebase project

1. Go to <https://console.firebase.google.com/> and sign in with any Google
   account.
2. Click **Add project**, give it any name (e.g. "digital-graveyard"), and
   finish the wizard (you can disable Google Analytics — not needed).
3. Once the project is created, click the **`</>`** (web) icon on the project
   overview page to register a new web app. Give it any nickname. You do
   **not** need Firebase Hosting — you're using GitHub Pages instead.
4. Firebase will show you a `firebaseConfig` object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "digital-graveyard-xxxxx.firebaseapp.com",
     projectId: "digital-graveyard-xxxxx",
     storageBucket: "digital-graveyard-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456"
   };
   ```

   Copy those values into `firebase-config.js` in this project, replacing the
   placeholder strings. Then change:

   ```js
   export const isFirebaseConfigured = false;
   ```

   to:

   ```js
   export const isFirebaseConfigured = true;
   ```

## 2. Turn on Firestore (the database)

1. In the Firebase console sidebar, go to **Build → Firestore Database**.
2. Click **Create database**. Choose any region close to you, and start in
   **production mode** (we'll set our own rules next).

## 3. Set Firestore security rules

This site has no login system — anyone can create a grave, and everyone can
read all graves (that's the point). Open **Firestore Database → Rules** and
replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /graves/{graveId} {
      allow read: if true;
      allow create: if
        request.resource.data.name is string &&
        request.resource.data.name.size() <= 75 &&
        request.resource.data.dates is string &&
        request.resource.data.dates.size() <= 20 &&
        request.resource.data.obituary is string &&
        request.resource.data.obituary.size() <= 500;
      allow update, delete: if false;
    }
  }
}
```

Click **Publish**. This keeps the same limits your form already enforces
(75 / 20 / 500 characters) and stops anyone from editing or deleting graves
once created, while still allowing open, public grave creation — same
trade-off as a guestbook. Because writes are open to anyone, treat this as a
fun public art project rather than a place for sensitive information, and
keep an eye on the Firestore console occasionally for spam.

## 4. Publish to GitHub Pages

1. Create a new GitHub repository and push all the files in this folder to
   it (root of the repo, or a `/docs` folder — your choice).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch,"
   pick your branch (e.g. `main`) and the folder these files live in
   (`/ (root)` or `/docs`).
4. Save. GitHub will give you a URL like
   `https://yourusername.github.io/your-repo-name/` — that's your live site.

No build step is needed; these are plain HTML/CSS/JS files, and Firebase is
loaded straight from Google's CDN in the browser.

## Notes on how it works

- **Grave placement:** new graves are placed in a loose grid near the center
  of the graveyard, in creation order, with a little random jitter — so
  graves cluster together the way you asked, and the site handles infinite
  new graves by growing rows downward.
- **Camera:** the world is one big absolutely-positioned layer; the avatar
  moves within it and the layer is transformed each frame to keep the avatar
  centered on screen.
- **Grave text box:** each grave has a hidden tooltip that becomes visible
  when the player's distance to that grave drops below a threshold.
- **Dates field:** restricted to digits, spaces, and hyphens (no letters),
  per your "only takes numbers" requirement, while still allowing something
  readable like `1948 - 2021`.
- **Live updates:** the explore page uses Firestore's realtime listener, so
  a grave created by one visitor appears for everyone currently browsing,
  without a refresh.

## Customizing

- Colors, fonts, and spacing are all in `style.css` (CSS variables at the
  top of the file).
- The ASCII art for trees/benches/flowers/fountain/tombstone/avatar lives at
  the top of `explore.js` — edit those template strings to change the look.
- Movement speed and how close you need to walk to reveal a grave's tooltip
  are the `SPEED` and `PROXIMITY_RADIUS` constants near the top of
  `explore.js`.
