using DotNetEnv;

namespace Tests.CSharp.Utils;

public static class EnvLoader
{
    private static bool _loaded = false;
    private static readonly object _lock = new object();

    /// <summary>
    /// Finds the .env file by searching from the assembly location up to the project root
    /// </summary>
    private static string? FindEnvFile()
    {
        // Try multiple locations:
        // 1. Current directory (works when running from project root)
        // 2. Assembly directory and walk up
        // 3. Project directory (tests-csharp folder)
        
        var currentDir = Directory.GetCurrentDirectory();
        var currentDirEnv = Path.Combine(currentDir, ".env");
        if (File.Exists(currentDirEnv))
            return currentDirEnv;

        // Try from assembly location
        var assemblyLocation = System.Reflection.Assembly.GetExecutingAssembly().Location;
        if (!string.IsNullOrEmpty(assemblyLocation))
        {
            var assemblyDir = Path.GetDirectoryName(assemblyLocation);
            if (!string.IsNullOrEmpty(assemblyDir))
            {
                // Walk up from bin/Debug/net9.0 to find project root
                var dir = new DirectoryInfo(assemblyDir);
                for (int i = 0; i < 4 && dir != null; i++)
                {
                    var envFile = Path.Combine(dir.FullName, ".env");
                    if (File.Exists(envFile))
                        return envFile;
                    
                    // Also check for tests-csharp directory
                    var testsCsharpDir = Path.Combine(dir.FullName, "tests-csharp");
                    if (Directory.Exists(testsCsharpDir))
                    {
                        var envFileInTestsCsharp = Path.Combine(testsCsharpDir, ".env");
                        if (File.Exists(envFileInTestsCsharp))
                            return envFileInTestsCsharp;
                    }
                    
                    dir = dir.Parent;
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Loads environment variables from .env file
    /// </summary>
    public static void Load()
    {
        if (_loaded) return;

        lock (_lock)
        {
            if (_loaded) return;

            var envPath = FindEnvFile();
            if (envPath != null && File.Exists(envPath))
            {
                Env.Load(envPath);
                Console.WriteLine($"✓ Loaded environment variables from: {envPath}");
            }
            else
            {
                var currentDir = Directory.GetCurrentDirectory();
                Console.WriteLine($"⚠ No .env file found. Searched in:");
                Console.WriteLine($"  - {Path.Combine(currentDir, ".env")}");
                Console.WriteLine($"  - Project directory and parent directories");
                Console.WriteLine($"  Using system environment variables or defaults.");
            }

            _loaded = true;
        }
    }

    /// <summary>
    /// Gets an environment variable with a default value
    /// </summary>
    public static string GetEnv(string key, string defaultValue = "")
    {
        Load();
        return Environment.GetEnvironmentVariable(key) ?? defaultValue;
    }

    /// <summary>
    /// Gets an environment variable as a boolean
    /// </summary>
    public static bool GetEnvBool(string key, bool defaultValue = false)
    {
        Load();
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrEmpty(value))
            return defaultValue;
        
        return value.Equals("true", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("1", StringComparison.OrdinalIgnoreCase) ||
               value.Equals("yes", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gets an environment variable as an integer
    /// </summary>
    public static int GetEnvInt(string key, int defaultValue = 0)
    {
        Load();
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrEmpty(value) || !int.TryParse(value, out int result))
            return defaultValue;
        return result;
    }
}

