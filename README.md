# File Browser

A small file and folder browser built for the take-home exercise. The goal was to get a useful end-to-end flow working without adding a frontend framework or a lot of project boilerplate.

## Run it

The project targets .NET 8. From this directory, run:

```powershell
dotnet run
```

The app serves the single-page browser at the project URL printed by `dotnet run`.

The browsable directory is configured in `appsettings.json`:

```json
"FileBrowser": {
  "RootPath": "SandboxFileFolder"
}
```

Relative paths are resolved from the application content root. An absolute path can be used instead.

## What’s implemented

- Browse folders and search files and folders through JSON API endpoints.
- Keep the current folder and search query in the URL, so views can be bookmarked and shared.
- Upload and download files in the browser.
- Show file and folder counts and total size for the current view.
- Delete individual files after confirmation. Folder deletion is intentionally not included.
- Search results load in pages as the list is scrolled.
- Custom 404 page

Paging was a middle ground for keeping the interface responsive without spending the take-home building a more involved search system. For larger directories, I could further improve backend search speed with approaches like maintaining a search index, caching results, or using a filesystem/database-backed query strategy. I didn’t implement those here because they add complexity and need different tradeoffs around freshness, storage, and invalidation; the current version keeps the proof of concept straightforward.

The frontend is plain JavaScript, HTML, and CSS. The API is implemented with ASP.NET Core controllers.

## A note on the UI

I know the exercise said UI wasn’t the focus, but I’m a UI person, so I couldn’t resist making the browser feel considered and easy to use. I added responsive layouts, clear search controls, file/folder icons, a styled delete confirmation dialog, and a scrollable results area with the header and summary kept visible. I tried to keep those touches in service of the browsing flow rather than turning this into a design-system project.

## A couple of implementation tradeoffs

- Search supports `offset` and `limit`, so the browser only renders a page of results at a time. The server still scans and sorts all matches for each request to calculate the overall counts and size; paging keeps the response and UI smaller, but does not reduce the filesystem scan.
- Search treats the query as literal text in file and folder names; characters like `*`, `?`, `/`, and `..` are not interpreted as wildcards or paths.
- Uploads use create-new behavior, so an existing file is not silently overwritten. Empty files are allowed.
- The configured root is checked for ordinary path traversal. This is a take-home prototype and does not resolve filesystem links that might point outside the root.

## API routes

- `GET /api/files/browse?path=...` — list a folder.
- `GET /api/files/search?path=...&query=...&offset=...&limit=...` — search recursively.
- `GET /api/files/download?path=...` — download a file.
- `POST /api/files/upload?path=...` — upload a file to a folder (`multipart/form-data`, field `file`).
- `DELETE /api/files/delete?path=...` — delete a file.

## AI assistance

I used AI as a helper while working through the take-home. I used Claude to compare my implementation with the project requirements, point out possible cleanup and edge cases, and help me verify behavior as I made changes. I also used it to help create sample folders and files for trying out browsing and search, and to draft this README.

I also used GitHub Copilot, which suggested a backend search index: scanning the folder tree and storing file metadata (names, paths, sizes, and modified dates) in a searchable index or database, so searches query the index instead of walking the filesystem every time. I chose not to build that. The take-home was meant to take a couple of hours, and paging seemed like a good middle ground. If I were building this for production, I would likely add the index.

Finally, I used AI as a quick syntax reference for things I couldn't remember offhand, mostly plain JavaScript and DOM patterns where I'd normally reach for the Angular equivalent. The implementation and design choices are mine, and I reviewed and tested the changes in the running app.
