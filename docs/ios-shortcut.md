# The iPhone shortcut ("All photos" on iOS)

Browsers cannot read an iPhone's photo library, and the Photos app is not a folder the
browser could open. An Apple Shortcut can: the game opens it with a private upload link,
the shortcut sends up to 24 random photos to the player's pool in the game room, and iOS
returns to the browser, where the normal "Play with these?" No/Yes choice continues. Only
the chosen photos are used; the pool is deleted as soon as the browser has it (at the latest
after 15 minutes).

The operator builds the shortcut **once**, shares it as an iCloud link, and puts that link
into `SHORTCUT.installUrl` in `web/shared/config.js`. Players add it with one tap the first
time they use "All photos".

## How the game calls it

```
shortcuts://x-callback-url/run-shortcut?name=Who%20Shot%20It&input=text
  &text=<upload link>                       the shortcut's input
  &x-success=<upload link>/done             marks the pool complete, back to the game
  &x-cancel=<game link>  &x-error=<game link>?setup=1
```

The upload link is `https://<domain>/api/rooms/<CODE>/pool/<token>`; each `POST` with one
JPEG as the raw body adds a photo (max 1.5 MB, max 30 per pool). The token is secret per
player and changes after every pickup. Code: `web/js/device.js` (`shortcutLink`),
`src/room.js` (`poolUpload`, `poolDone`, `takePool`).

## Build it (iPhone, Shortcuts app, about 5 minutes)

Actions are added with the search field at the bottom of the editor. On an iPhone set to
German, search for the name in brackets.

1. Open **Shortcuts**, tap **+**. Tap the name at the top → **Rename** → exactly
   **`Who Shot It`** (no question mark; it must match `SHORTCUT.name`).
2. Add **Find Photos** (*Fotos suchen*):
   - **Add Filter**, tap the filter's first word and pick **Is Not a Screenshot**.
   - **Add Filter** again, pick **Media Type** and set it to **Image** (so videos are skipped).
   - **Sort by** → **Random**.
   - Turn on **Limit** and set the row below it to **24** (tap the number, or use +).
3. Add **Repeat with Each** (*Mit jedem wiederholen*). It repeats with each item in *Photos*.
4. Add **Resize Image** (*Bildgröße ändern*) and make sure it sits between **Repeat with
   Each** and **End Repeat** (drag it there if it landed below). It reads *Resize Repeat Item
   to Width × Auto Height*: tap **Width**, type **1080**, leave **Auto Height**.
5. Below it, add **Convert Image** (*Bild konvertieren*): *Resized Image* to **JPEG**. Tap the
   arrow (›) on the action to show more: **Quality** about **70 %**, **Preserve Metadata**
   off (no location data leaves the phone).
6. Below it, add **Get Contents of URL** (*Inhalte von URL abrufen*):
   - Tap **URL** and pick the variable **Shortcut Input** (*Kurzbefehleingabe*) in the bar
     above the keyboard (or through **Select Variable**).
   - Tap the arrow (›) to show more: **Method** **POST**, **Request Body** **File**, then tap
     **File** and pick **Converted Image**.
7. Check the order, then tap **Done**. Nothing follows *End Repeat*: iOS returns to the game
   by itself.
   ```
   Find Photos
   Repeat with Each item in Photos
     Resize Image
     Convert Image
     Get Contents of URL
   End Repeat
   ```
   If a line *Receive … input from …* shows at the top, it must accept **Any** (the default)
   or **Text**.
8. Common slips:
   - A **red** variable (for example *Repeat Results* inside the repeat) points to the wrong
     action: tap it → **Clear**, tap the empty field → **Select Variable** → tap the right
     output (*Repeat Item* for Resize Image, *Resized Image* for Convert Image).
   - *Shortcut Input* belongs in the **URL** field right after "Get contents of", not in
     **Method** (which must say **POST**).
   - The name at the top of the editor must read **Who Shot It** (tap it → **Rename**).

## Share it

iCloud Sync for Shortcuts must be on (Settings → Apps → Shortcuts → **iCloud Sync**). In the
Shortcuts list, tap **…** on **Who Shot It** to open it, tap the **Share** button, then
**Copy iCloud Link** → **Copy Link**. Paste the link (`https://www.icloud.com/shortcuts/…`)
as `SHORTCUT.installUrl` in `web/shared/config.js`, replacing the `TODO_OPERATOR:` text.
The shortcut contains no personal data: the upload link is handed over each time it runs.

## Check it

After deploying, on an iPhone in Safari: join a game → **All photos** → **1 Add shortcut**
(opens the iCloud page, tap **Add Shortcut**) → back in Safari **2 Load photos**. The first
run asks for access to photos and to send them: tap **Allow** (for photos: *Allow Full
Access*). Safari returns to the game and shows "Play with these?". From then on, "All
photos" is a single tap.

If the shortcut is renamed or deleted on a phone, Shortcuts reports an error, iOS returns
with `?setup=1`, and the game shows the two setup steps again.
