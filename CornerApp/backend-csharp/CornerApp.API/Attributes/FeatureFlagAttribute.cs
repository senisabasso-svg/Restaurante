using CornerApp.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace CornerApp.API.Attributes;

/// <summary>
/// Atributo para proteger endpoints con feature flags
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class FeatureFlagAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _featureName;
    private readonly bool _requireUserContext;

    public FeatureFlagAttribute(string featureName, bool requireUserContext = false)
    {
        _featureName = featureName;
        _requireUserContext = requireUserContext;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var featureFlagsService = context.HttpContext.RequestServices.GetRequiredService<IFeatureFlagsService>();
        
        bool isEnabled;
        
        if (_requireUserContext)
        {
            // Intentar obtener userId del contexto
            var userIdClaim = context.HttpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int? userId = null;
            
            if (int.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }
            
            isEnabled = featureFlagsService.IsEnabledForUser(_featureName, userId);
        }
        else
        {
            isEnabled = featureFlagsService.IsEnabled(_featureName);
        }

        if (!isEnabled)
        {
            context.Result = new NotFoundObjectResult(new
            {
                success = false,
                message = "Esta funcionalidad no está disponible",
                errorCode = "FEATURE_DISABLED",
                featureName = _featureName,
                requestId = context.HttpContext.Items["RequestId"]?.ToString()
            });
            return;
        }

        await next();
    }
}
