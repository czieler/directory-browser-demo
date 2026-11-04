using Microsoft.Extensions.Options;
 
namespace TestProject;
 
public sealed class PathResolver {
 
    private readonly string _rootPrefix;
 
    public PathResolver(IOptions<FileBrowserOptions> options, IHostEnvironment environment) {
        Root = Path.GetFullPath(options.Value.RootPath, environment.ContentRootPath);
        _rootPrefix = Root + Path.DirectorySeparatorChar;
    }
 
    public string Root { get; }
 
    public bool RootExists => Directory.Exists(Root);
 
    // Works out the full path the caller is asking for, and returns false if it
    // sits outside the configured root.
    public bool TryResolve(string? relativePath, out string fullPath) {
        fullPath = Path.GetFullPath(Path.Combine(Root, relativePath ?? ""));
 
        return fullPath == Root || fullPath.StartsWith(_rootPrefix, StringComparison.Ordinal);
    }
}