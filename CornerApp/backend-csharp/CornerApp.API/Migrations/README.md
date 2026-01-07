# Migraciones de Base de Datos

Este proyecto usa Entity Framework Core con migraciones.

## Crear una nueva migración

```bash
dotnet ef migrations add InitialCreate
```

## Aplicar migraciones

```bash
dotnet ef database update
```

## Revertir última migración

```bash
dotnet ef database update PreviousMigrationName
```

## Eliminar última migración (si no se ha aplicado)

```bash
dotnet ef migrations remove
```

## Nota

Las migraciones se aplican automáticamente al iniciar la aplicación en modo desarrollo.

