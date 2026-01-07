namespace CornerApp.API.Attributes;

/// <summary>
/// Atributo para especificar la versión de API de un endpoint
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class ApiVersionAttribute : Attribute
{
    public string Version { get; }

    public ApiVersionAttribute(string version)
    {
        Version = version;
    }
}
