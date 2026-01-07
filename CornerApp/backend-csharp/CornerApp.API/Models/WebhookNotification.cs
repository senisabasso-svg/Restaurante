using System.Text.Json.Serialization;

namespace CornerApp.API.Models;

public class WebhookNotification
{
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    [JsonPropertyName("data")]
    public WebhookData? Data { get; set; }

    [JsonPropertyName("action")]
    public string? Action { get; set; }

    [JsonPropertyName("date_created")]
    public DateTime? DateCreated { get; set; }

    [JsonPropertyName("id")]
    public long? Id { get; set; }

    [JsonPropertyName("live_mode")]
    public bool? LiveMode { get; set; }

    [JsonPropertyName("user_id")]
    public string? UserId { get; set; }
}

public class WebhookData
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }
}

