using Microsoft.AspNetCore.Mvc;

namespace TestProject.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FilesController : ControllerBase {

    private record ListingEntry(string name, string path, bool isFolder, long? size, DateTime modified);

    private readonly PathResolver _paths;

    public FilesController(PathResolver paths) {
        _paths = paths;
    }

    [HttpGet("browse")]
    public IActionResult Browse(string? path) {
        var error = ResolveFolder(path, out var folder);

        if (error != null) {
            return error;
        }

        return BuildListing(path, folder.EnumerateFileSystemInfos());
    }

    [HttpGet("search")]
    public IActionResult Search(string? path, string query, int offset = 0, int limit = 50) {
        if (string.IsNullOrWhiteSpace(query)) {
            return BadRequest("Search query is required.");
        }

        if (offset < 0 || limit < 1 || limit > 100) {
            return BadRequest("Offset must be non-negative and limit must be between 1 and 100.");
        }

        var error = ResolveFolder(path, out var folder);

        if (error != null) {
            return error;
        }

        var options = new EnumerationOptions {
            RecurseSubdirectories = true,
            // one locked folder would throw and kill the whole search
            IgnoreInaccessible = true,
            MatchCasing = MatchCasing.CaseInsensitive
        };

        return BuildListing(path, folder.EnumerateFileSystemInfos("*" + query + "*", options), offset, limit);
    }

    [HttpGet("download")]
    public IActionResult Download(string path) {
        var error = ResolveFile(path, out var fullPath);

        if (error != null) {
            return error;
        }

        // octet-stream so the browser downloads instead of trying to display it
        return PhysicalFile(fullPath, "application/octet-stream", Path.GetFileName(fullPath), enableRangeProcessing: true);
    }

    // File deletion only for this take home.  
    // Don't want someone accidentally deleting a whole folder.
    [HttpDelete("delete")]
    public IActionResult Delete(string path) {
        var error = ResolveFile(path, out var fullPath);

        if (error != null) {
            return error;
        }

        System.IO.File.Delete(fullPath);
        return NoContent();
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(string? path, IFormFile file) {
        var error = ResolveFolder(path, out var folder);

        if (error != null) {
            return error;
        }

        // The client picks this name, so strip any folder parts out of it
        var name = Path.GetFileName(file.FileName);

        if (string.IsNullOrWhiteSpace(name)) {
            return BadRequest("File name is missing.");
        }

        var target = Path.Combine(folder.FullName, name);

        if (System.IO.File.Exists(target)) {
            return Conflict($"{name} already exists here.");
        }

        FileStream stream;
        try {
            stream = new FileStream(target, FileMode.CreateNew);
        } catch (IOException) when (System.IO.File.Exists(target)) {
            return Conflict($"{name} already exists here.");
        }

        await using (stream) {
            await file.CopyToAsync(stream);
        }

        return Ok();
    }

    // Returns null when the path is usable, otherwise the response to send back.
    private IActionResult? Resolve(string? path, out string fullPath) {
        fullPath = _paths.Root;

        if (!_paths.RootExists) {
            return Problem($"Root path not found: {_paths.Root}. Set FileBrowser:RootPath in appsettings.json.");
        }

        if (!_paths.TryResolve(path, out fullPath)) {
            return BadRequest("Path is outside the root folder.");
        }

        return null;
    }

    // Resolves a path and checks that it points to an existing file.
    private IActionResult? ResolveFile(string path, out string fullPath) {
        var error = Resolve(path, out fullPath);

        if (error != null) {
            return error;
        }

        // System.IO.File because ControllerBase already has a File() method
        return System.IO.File.Exists(fullPath) ? null : NotFound();
    }

    // Same, but the path has to be a folder that exists.
    private IActionResult? ResolveFolder(string? path, out DirectoryInfo folder) {
        folder = new DirectoryInfo(_paths.Root);

        var error = Resolve(path, out var fullPath);

        if (error != null) {
            return error;
        }

        if (!Directory.Exists(fullPath)) {
            return NotFound();
        }

        folder = new DirectoryInfo(fullPath);
        return null;
    }

    // Shapes a set of files and folders into the JSON both browse and search return.
    private IActionResult BuildListing(string? path, IEnumerable<FileSystemInfo> source, int? offset = null, int limit = 50) {
        var orderedEntries = source
            .Select(entry => new ListingEntry(
                entry.Name,
                // forward slashes so these match the paths the URL uses
                Path.GetRelativePath(_paths.Root, entry.FullName).Replace('\\', '/'),
                entry is DirectoryInfo,
                entry is FileInfo file ? file.Length : null,
                entry.LastWriteTimeUtc))
            // folders first
            .OrderByDescending(entry => entry.isFolder)
            .ThenBy(entry => entry.name, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.path, StringComparer.OrdinalIgnoreCase);

        var allEntries = orderedEntries.ToList();
        var entries = offset.HasValue
            ? allEntries.Skip(offset.Value).Take(limit).ToList()
            : allEntries;
        var hasMore = offset.HasValue && (long)offset.Value + entries.Count < allEntries.Count;

        return Ok(new {
            path = path ?? "",
            folderCount = allEntries.Count(entry => entry.isFolder),
            fileCount = allEntries.Count(entry => !entry.isFolder),
            totalSize = allEntries.Sum(entry => entry.size ?? 0),
            hasMore,
            entries
        });
    }
}