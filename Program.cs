namespace TestProject {
    public class Program {
        public static void Main(string[] args) {
            var builder = WebApplication.CreateBuilder(args);

            builder.Services.AddControllers();
            // Root directory the browser can serve, see appsettings.json.
            builder.Services.Configure<FileBrowserOptions>(builder.Configuration.GetSection("FileBrowser"));
            builder.Services.AddSingleton<PathResolver>();

            var app = builder.Build();

            app.UseHttpsRedirection();
            app.UseStatusCodePagesWithReExecute("/404.html"); // custom 404 page
            app.UseDefaultFiles(); // so we don't have to type index.html in the URL
            app.UseStaticFiles();
            app.MapControllers();

            app.Run();
        }
    }
}