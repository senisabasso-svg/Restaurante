namespace CornerApp.API.Constants;

/// <summary>
/// Constantes generales de la aplicación
/// </summary>
public static class AppConstants
{
    // Configuración de entrega
    public const int DEFAULT_DELIVERY_TIME_MINUTES = 30;
    public const int MIN_DELIVERY_TIME_MINUTES = 15;
    public const int MAX_DELIVERY_TIME_MINUTES = 120;
    public const double AVERAGE_DELIVERY_SPEED_KMH = 30.0;
    public const int PREPARATION_TIME_MINUTES = 10;
    public const int DEFAULT_POINTS_PER_ORDER = 1;

    // Límites de archivos
    public const int MAX_ICON_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    public const int MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    public const int MAX_ICON_FILE_SIZE_MB = 2;
    public const int MAX_PRODUCT_IMAGE_SIZE_MB = 5;

    // Extensiones permitidas
    public static readonly string[] ALLOWED_IMAGE_EXTENSIONS = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
    public static readonly string[] ALLOWED_ICON_EXTENSIONS = { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };

    // Configuración de imágenes
    public const int MAX_IMAGE_WIDTH_PX = 1200;
    public const int MAX_ICON_WIDTH_PX = 256; // Tamaño máximo recomendado para iconos

    // Paths y URLs de archivos
    public const string WWWROOT_FOLDER = "wwwroot";
    public const string IMAGES_FOLDER = "images";
    public const string CATEGORIES_FOLDER = "categories";
    public const string PRODUCTS_FOLDER = "products";
    
    // URLs base para imágenes
    public const string CATEGORIES_IMAGE_URL_BASE = "/images/categories/";
    public const string PRODUCTS_IMAGE_URL_BASE = "/images/products/";
}
