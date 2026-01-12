using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using CornerApp.API.Models;

namespace CornerApp.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Product> Products { get; set; }
    public DbSet<SubProduct> SubProducts { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<Customer> Customers { get; set; }
    public DbSet<Category> Categories { get; set; }
    public DbSet<DeliveryPerson> DeliveryPersons { get; set; }
    public DbSet<PaymentMethod> PaymentMethods { get; set; }
    public DbSet<WebhookSubscription> WebhookSubscriptions { get; set; }
    public DbSet<OrderStatusHistory> OrderStatusHistory { get; set; }
    public DbSet<BusinessInfo> BusinessInfo { get; set; }
    public DbSet<DeliveryZoneConfig> DeliveryZoneConfigs { get; set; }
    public DbSet<EmailConfig> EmailConfigs { get; set; }
    public DbSet<Admin> Admins { get; set; }
    public DbSet<Reward> Rewards { get; set; }
    public DbSet<Table> Tables { get; set; }
    public DbSet<Space> Spaces { get; set; }
    public DbSet<CashRegister> CashRegisters { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configurar Category
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Icon).HasMaxLength(200);
            entity.HasIndex(e => e.Name).IsUnique();
            
            // Índices para optimizar consultas frecuentes
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.DisplayOrder);
            entity.HasIndex(e => new { e.IsActive, e.DisplayOrder }); // Índice compuesto para consultas comunes
        });

        // Configurar Product
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.Image).HasMaxLength(500);
            
            // Relación con Category
            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Products)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Restrict);
            
            // Índices para optimizar consultas frecuentes
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.IsAvailable);
            entity.HasIndex(e => e.DisplayOrder);
            entity.HasIndex(e => new { e.CategoryId, e.IsAvailable, e.DisplayOrder }); // Índice compuesto para consultas comunes
        });

        // Configurar SubProduct
        modelBuilder.Entity<SubProduct>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Price).HasColumnType("decimal(18,2)");
            entity.Property(e => e.IsAvailable).HasDefaultValue(true);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            
            // Relación con Product
            entity.HasOne(e => e.Product)
                  .WithMany(p => p.SubProducts)
                  .HasForeignKey(e => e.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);
            
            // Índices para optimizar consultas frecuentes
            entity.HasIndex(e => e.ProductId);
            entity.HasIndex(e => e.IsAvailable);
            entity.HasIndex(e => e.DisplayOrder);
            entity.HasIndex(e => new { e.ProductId, e.IsAvailable, e.DisplayOrder }); // Índice compuesto para consultas comunes
        });

        // Configurar Customer
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.Property(e => e.DefaultAddress).HasMaxLength(500);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Points).HasDefaultValue(0);
            
            // Índice único en email
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Phone);
        });

        // Configurar DeliveryPerson
        modelBuilder.Entity<DeliveryPerson>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            
            // Índice único en username y email
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Phone);
        });

        // Configurar PaymentMethod
        modelBuilder.Entity<PaymentMethod>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(50);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Icon).HasMaxLength(10);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.RequiresReceipt).HasDefaultValue(false);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // Configurar Order
        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CustomerName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.CustomerPhone).HasMaxLength(50);
            entity.Property(e => e.CustomerAddress).HasMaxLength(500);
            entity.Property(e => e.CustomerEmail).HasMaxLength(200);
            entity.Property(e => e.PaymentMethod).HasMaxLength(50);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Total).HasColumnType("decimal(18,2)");
            entity.Property(e => e.MercadoPagoPreferenceId).HasMaxLength(200);
            entity.Property(e => e.MercadoPagoPaymentId).HasMaxLength(200);
            entity.Property(e => e.TransferReceiptImage).HasColumnType("nvarchar(max)"); // Base64 image puede ser grande
            entity.Property(e => e.IsReceiptVerified).HasDefaultValue(false);
            entity.Property(e => e.ReceiptVerifiedBy).HasMaxLength(200);
            entity.Property(e => e.IsArchived).HasDefaultValue(false);
            entity.Property(e => e.DeliveryLatitude).HasColumnType("float");
            entity.Property(e => e.DeliveryLongitude).HasColumnType("float");
            entity.Property(e => e.CustomerLatitude).HasColumnType("float");
            entity.Property(e => e.CustomerLongitude).HasColumnType("float");
            entity.Property(e => e.Comments).HasMaxLength(1000); // Comentarios del pedido
            
            // Relación con Customer (opcional)
            entity.HasOne(e => e.Customer)
                  .WithMany(c => c.Orders)
                  .HasForeignKey(e => e.CustomerId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Relación con DeliveryPerson (opcional)
            entity.HasOne(e => e.DeliveryPerson)
                  .WithMany(d => d.Orders)
                  .HasForeignKey(e => e.DeliveryPersonId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Relación con Table (opcional)
            entity.HasOne(e => e.Table)
                  .WithMany(t => t.Orders)
                  .HasForeignKey(e => e.TableId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Configurar relación con OrderItems (owned entity collection)
            entity.OwnsMany(e => e.Items, item =>
            {
                item.WithOwner().HasForeignKey("OrderId");
                var idProperty = item.Property<int>("Id");
                idProperty.ValueGeneratedOnAdd();
                if (Database.IsSqlServer())
                {
                    idProperty.UseIdentityColumn();
                }
                item.HasKey("Id");
                item.Property(i => i.ProductId).IsRequired();
                item.Property(i => i.ProductName).IsRequired().HasMaxLength(200);
                item.Property(i => i.UnitPrice).HasColumnType("decimal(18,2)").IsRequired();
                item.Property(i => i.Quantity).IsRequired();
                item.Property(i => i.SubProductsJson).HasMaxLength(2000); // JSON string para subproductos
                
                // Ignorar propiedades calculadas que no deben ser mapeadas a la base de datos
                item.Ignore(i => i.SubProducts); // Propiedad calculada que serializa/deserializa desde SubProductsJson
                item.Ignore(i => i.Subtotal); // Propiedad calculada (UnitPrice * Quantity)
                
                item.ToTable("OrderItems");
                item.HasIndex("OrderId");
            });
            
            // Índices para optimizar consultas frecuentes de Orders
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.CustomerId);
            entity.HasIndex(e => e.DeliveryPersonId);
            entity.HasIndex(e => e.TableId);
            entity.HasIndex(e => e.IsArchived);
            entity.HasIndex(e => new { e.Status, e.CreatedAt }); // Índice compuesto para consultas por estado y fecha
            entity.HasIndex(e => new { e.CustomerId, e.IsArchived }); // Índice compuesto para consultas de cliente
            entity.HasIndex(e => new { e.DeliveryPersonId, e.Status }); // Índice compuesto para consultas de repartidor
        });

        // Configurar WebhookSubscription
        modelBuilder.Entity<WebhookSubscription>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Url).IsRequired().HasMaxLength(500);
            entity.Property(e => e.EventType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Secret).HasMaxLength(500);
            entity.Property(e => e.Headers).HasColumnType("nvarchar(max)");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.SuccessCount).HasDefaultValue(0);
            entity.Property(e => e.FailureCount).HasDefaultValue(0);
            
            // Índices para optimizar consultas
            entity.HasIndex(e => e.EventType);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.EventType, e.IsActive }); // Índice compuesto para consultas por evento
        });

        // Configurar Admin
        modelBuilder.Entity<Admin>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.Property(e => e.PasswordHash).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            
            // Índices únicos
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
        });

        // Configurar Reward
        modelBuilder.Entity<Reward>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.PointsRequired).HasDefaultValue(0);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.DiscountPercentage).HasColumnType("decimal(5,2)");
            entity.HasIndex(e => e.IsActive);
        });

        // Configurar EmailConfig
        modelBuilder.Entity<EmailConfig>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SmtpHost).HasMaxLength(200);
            entity.Property(e => e.SmtpPort).HasDefaultValue(587);
            entity.Property(e => e.SmtpUseSsl).HasDefaultValue(true);
            entity.Property(e => e.SmtpUsername).HasMaxLength(200);
            entity.Property(e => e.SmtpPassword).HasMaxLength(500);
            entity.Property(e => e.FromEmail).HasMaxLength(200);
            entity.Property(e => e.FromName).HasMaxLength(100).HasDefaultValue("CornerApp");
            entity.Property(e => e.IsEnabled).HasDefaultValue(false);
        });

        // Configurar Space
        modelBuilder.Entity<Space>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            
            // Índices para optimizar consultas
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.IsActive);
        });

        // Configurar Table
        modelBuilder.Entity<Table>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Number).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Capacity).HasDefaultValue(4);
            entity.Property(e => e.Location).HasMaxLength(100);
            entity.Property(e => e.PositionX).HasColumnType("float");
            entity.Property(e => e.PositionY).HasColumnType("float");
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50).HasDefaultValue("Available");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.OrderPlacedAt).HasColumnType("datetime2");
            
            // Relación con Space (opcional)
            entity.HasOne(e => e.Space)
                  .WithMany(s => s.Tables)
                  .HasForeignKey(e => e.SpaceId)
                  .OnDelete(DeleteBehavior.SetNull);
            
            // Índices para optimizar consultas
            entity.HasIndex(e => e.Number);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.IsActive);
            entity.HasIndex(e => e.SpaceId);
            entity.HasIndex(e => new { e.IsActive, e.Status }); // Índice compuesto para consultas comunes
        });

        // Configurar CashRegister
        modelBuilder.Entity<CashRegister>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.InitialAmount).HasColumnType("decimal(18,2)").IsRequired();
            entity.Property(e => e.FinalAmount).HasColumnType("decimal(18,2)");
            entity.Property(e => e.TotalSales).HasColumnType("decimal(18,2)").HasDefaultValue(0);
            entity.Property(e => e.TotalCash).HasColumnType("decimal(18,2)").HasDefaultValue(0);
            entity.Property(e => e.TotalPOS).HasColumnType("decimal(18,2)").HasDefaultValue(0);
            entity.Property(e => e.TotalTransfer).HasColumnType("decimal(18,2)").HasDefaultValue(0);
            entity.Property(e => e.CreatedBy).HasMaxLength(200);
            entity.Property(e => e.ClosedBy).HasMaxLength(200);
            entity.Property(e => e.Notes).HasMaxLength(1000);
            
            // Índices para optimizar consultas
            entity.HasIndex(e => e.IsOpen);
            entity.HasIndex(e => e.OpenedAt);
            entity.HasIndex(e => e.ClosedAt);
            entity.HasIndex(e => new { e.IsOpen, e.OpenedAt }); // Índice compuesto para consultas de caja abierta
        });
    }
}

