using Tests.CSharp.Utils;

namespace Tests.CSharp;

public class User
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public static class Users
{
    public static readonly User Standard = new()
    {
        Username = "standard_user",
        Password = "secret_sauce",
        Description = "The site should work as expected for this user"
    };

    public static readonly User LockedOut = new()
    {
        Username = "locked_out_user",
        Password = "secret_sauce",
        Description = "User is locked out and should not be able to log in"
    };

    public static readonly User Problem = new()
    {
        Username = "problem_user",
        Password = "secret_sauce",
        Description = "Images are not loading for this user"
    };

    public static readonly User PerformanceGlitch = new()
    {
        Username = "performance_glitch_user",
        Password = "secret_sauce",
        Description = "This user has high loading times"
    };
}

public static class TestData
{
    // Load BaseUrl from .env file, fallback to default
    public static string BaseUrl => EnvLoader.GetEnv("BASE_URL", "https://qa-challenge.codesubmit.io");
    
    public static class Timeouts
    {
        public const int Short = 5000;
        public const int Medium = 10000;
        public const int Long = 30000;
    }
}

