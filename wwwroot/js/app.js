import { downloadUrl, listing, removeFile, upload } from "./api.js";

const rowsEl = document.getElementById("rows");
const summaryEl = document.getElementById("summary");
const searchEl = document.getElementById("search");
const clearSearchEl = document.getElementById("clear-search");
const rowTemplate = document.getElementById("row-template");
const uploadEl = document.getElementById("upload");
const searchSentinel = document.getElementById("search-sentinel");
const deleteDialog = document.getElementById("delete-dialog");
const deleteFileNameEl = document.getElementById("delete-file-name");
const cancelDeleteButton = deleteDialog.querySelector('[value="cancel"]');

function updateScrollbarWidth() {
  const scrollbarWidth = rowsEl.offsetWidth - rowsEl.clientWidth;

  document.documentElement.style.setProperty(
    "--scrollbar-width",
    `${scrollbarWidth}px`,
  );
}

const searchPageSize = 50;
let currentPath = "";
let currentQuery = "";
let searchOffset = 0;
let searchHasMore = false;
let searchPageLoading = false;
let searchDebounce;

const searchObserver = new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadNextSearchPage();
    }
  },
  { root: rowsEl, rootMargin: "100px" },
);
searchObserver.observe(searchSentinel);

// changes the URL, then loads that folder or search
function goToPath(path, query) {
  const params = new URLSearchParams();

  if (path) {
    params.set("path", path);
  }

  if (query) {
    params.set("query", query);
  }

  const search = params.toString();

  history.pushState(null, "", search ? "?" + search : "/");
  load(path, query);
}

// loads whatever the URL says, for the first load and back/forward
function loadFromUrl() {
  const params = new URLSearchParams(location.search);

  load(params.get("path") ?? "", params.get("query") ?? "");
}

// marvel/avengers -> marvel
function parentPath(path) {
  const cut = path.lastIndexOf("/");

  return cut === -1 ? "" : path.slice(0, cut);
}

function formatFileSize(bytes) {
  if (bytes === 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return "1 KB";
  }

  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return size.toFixed(1) + " " + units[unit];
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

// fills in a row from the template. folders navigate on click, files link
// straight to the download so save as and middle click work
function buildRow(fields, open, href, onDelete) {
  // Clone the row markup so each item gets its own elements and event handlers.
  const row = rowTemplate.content.cloneNode(true);

  for (const [field, text] of Object.entries(fields)) {
    if (field === "name") {
      row.querySelector("[data-name]").textContent = text;
    } else {
      row.querySelector(`[data-field="${field}"]`).textContent = text;
    }
  }

  const link = row.querySelector("a");
  // The template hides both icons; show the folder or file icon for this row.
  row
    .querySelector(open ? "[data-folder-icon]" : "[data-file-icon]")
    .removeAttribute("hidden");

  const deleteButton = row.querySelector("[data-delete]");

  // Only files get a delete action.
  deleteButton.hidden = !onDelete;
  if (onDelete) {
    deleteButton.addEventListener("click", onDelete);
  }

  if (open) {
    // Folders navigate in the app; files keep a normal download link.
    link.href = "#";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      open();
    });
  } else {
    link.href = href;
  }

  return row;
}

// draws the list and the counts line
function render(data, query, append) {
  searchEl.value = query;
  clearSearchEl.hidden = !query;
  if (!append) {
    rowsEl.replaceChildren(searchSentinel);
  }

  if (data.path && !query) {
    const parent = parentPath(data.path);

    // row at the top that goes up a folder
    rowsEl.insertBefore(
      buildRow({ name: ".." }, () => goToPath(parent, "")),
      searchSentinel,
    );
  }

  for (const entry of data.entries) {
    const fields = {
      // search results come from different folders, so show the full path
      name: query ? entry.path : entry.name,
      size: entry.isFolder ? "" : formatFileSize(entry.size),
      modified: formatDate(entry.modified),
    };
    const open = entry.isFolder ? () => goToPath(entry.path, "") : null;
    const onDelete = entry.isFolder
      ? null
      : () => deleteFile(entry.path, entry.name);

    rowsEl.insertBefore(
      buildRow(fields, open, downloadUrl(entry.path), onDelete),
      searchSentinel,
    );
  }

  if (query && !append && data.entries.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.textContent = "No files were found.";
    row.appendChild(cell);
    rowsEl.insertBefore(row, searchSentinel);
  }

  if (query) {
    searchOffset += data.entries.length;
    searchHasMore = data.hasMore;
    const totalCount = data.folderCount + data.fileCount;

    summaryEl.textContent = `${totalCount} search results, ${formatFileSize(data.totalSize)}`;
  } else {
    summaryEl.textContent = `${data.folderCount} folders, ${data.fileCount} files, ${formatFileSize(data.totalSize)}`;
  }

  updateScrollbarWidth();
}

function renderError(message) {
  rowsEl.replaceChildren();
  summaryEl.textContent = message;
  updateScrollbarWidth();
}

// gets the data and draws it, errors show up on the page
async function load(path, query, append = false) {
  if (!append) {
    currentQuery = query;
    searchOffset = 0;
    searchHasMore = false;
  }

  try {
    const data = await listing(path, query, searchOffset, searchPageSize);

    currentPath = data.path;
    render(data, query, append);
  } catch (error) {
    if (error.status === 404) {
      window.location.assign("/404.html");
      return;
    }

    renderError(error.message);
  }
}

async function loadNextSearchPage() {
  if (!currentQuery || !searchHasMore || searchPageLoading) {
    return;
  }

  searchPageLoading = true;
  try {
    await load(currentPath, currentQuery, true);
  } finally {
    searchPageLoading = false;
  }
}

async function uploadFile(file) {
  try {
    await upload(currentPath, file);
    goToPath(currentPath, "");
  } catch (error) {
    renderError(error.message);
  }
}

async function deleteFile(path, name) {
  deleteFileNameEl.textContent = name;
  deleteDialog.showModal();
  cancelDeleteButton.focus();

  const confirmed = await new Promise((resolve) => {
    deleteDialog.addEventListener(
      "close",
      () => resolve(deleteDialog.returnValue === "delete"),
      { once: true },
    );
  });

  if (!confirmed) {
    return;
  }

  try {
    await removeFile(path);
    load(currentPath, currentQuery);
  } catch (error) {
    renderError(error.message);
  }
}

searchEl.addEventListener("input", () => {
  clearSearchEl.hidden = searchEl.value.length === 0;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(
    () => goToPath(currentPath, searchEl.value.trim()),
    750,
  );
});

clearSearchEl.addEventListener("click", () => {
  clearTimeout(searchDebounce);
  searchEl.value = "";
  clearSearchEl.hidden = true;
  goToPath(currentPath, "");
  searchEl.focus();
});

uploadEl.addEventListener("change", () => {
  if (uploadEl.files.length > 0) {
    uploadFile(uploadEl.files[0]);
    // clear it, or picking the same file again fires no change event
    uploadEl.value = "";
  }
});

// back and forward just load, they don't push another URL
window.addEventListener("popstate", loadFromUrl);
window.addEventListener("resize", updateScrollbarWidth);

updateScrollbarWidth();
loadFromUrl();
