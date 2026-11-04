namespace TestProject;

public class FileBrowserOptions {

    /// <summary>Used when no root path is configured.</summary>
    public const string DefaultRootPath = "SandboxFileFolder";

    /// <summary>
    /// Directory the browser is allowed to serve. Relative paths resolve
    /// against the application's content root; absolute paths are used as-is.
    /// </summary>
    public string RootPath { get; set; } = DefaultRootPath;
}
