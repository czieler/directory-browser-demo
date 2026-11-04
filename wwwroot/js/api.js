const base = "/api/files";

export function downloadUrl(path) {
  return `${base}/download?path=${encodeURIComponent(path)}`;
}

// browse, or search when there's a query
export async function listing(path, query, offset = 0, limit = 50) {
  const params = new URLSearchParams({ path });

  if (query) {
    params.set("query", query);
    params.set("offset", offset);
    params.set("limit", limit);
  }

  const response = await send(
    `${base}/${query ? "search" : "browse"}?${params}`,
  );
  return response.json();
}

export async function upload(path, file) {
  const body = new FormData();
  body.append("file", file);

  await send(`${base}/upload?path=${encodeURIComponent(path)}`, {
    method: "POST",
    body,
  });
}

export async function removeFile(path) {
  const params = new URLSearchParams({ path });
  await send(`${base}/delete?${params}`, { method: "DELETE" });
}

// throws the server's error message if the request fails
async function send(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(await response.text());
    error.status = response.status;
    throw error;
  }

  return response;
}
