# Monitoring y Observabilidad Avanzada

## Descripción

Este documento describe el sistema de monitoreo y observabilidad implementado en CornerApp API, incluyendo Prometheus, métricas personalizadas y telemetría.

## Componentes de Monitoreo

### 1. Prometheus Metrics

Sistema de métricas estándar de la industria para monitoreo y alertas.

**Endpoint**: `/metrics`

**Métricas Automáticas**:
- `http_requests_received_total`: Total de requests recibidos
- `http_requests_duration_seconds`: Duración de requests
- `http_requests_active`: Requests activos actualmente

**Métricas Personalizadas**:
- `cornerapp_http_requests_total`: Requests por método, endpoint y status code
- `cornerapp_http_errors_total`: Errores por tipo
- `cornerapp_cache_hits_total`: Cache hits
- `cornerapp_cache_misses_total`: Cache misses
- `cornerapp_http_request_duration_seconds`: Duración de requests
- `cornerapp_active_requests`: Requests activos
- `cornerapp_cache_size`: Tamaño del cache

### 2. Health Checks

Endpoints de salud del sistema:
- `/health`: Health check general
- `/health/detailed`: Health check detallado con todos los checks
- `/health/ready`: Readiness check
- `/health/live`: Liveness check

### 3. Métricas Personalizadas (API)

Endpoint JSON con métricas de la aplicación:
- `/api/metrics`: Métricas en formato JSON

## Configuración

### appsettings.json

```json
{
  "Metrics": {
    "EnableMetrics": true,
    "EnableMetricsEndpoint": true,
    "TopEndpointsLimit": 20,
    "Prometheus": {
      "Enabled": true
    }
  }
}
```

### Variables de Entorno

```bash
Metrics__Prometheus__Enabled=true
```

## Uso de Prometheus

### Ver Métricas

```bash
# Acceder al endpoint de métricas
curl http://localhost:5000/metrics

# Ejemplo de salida:
# http_requests_received_total{method="GET",code="200"} 1234
# http_requests_duration_seconds_bucket{method="GET",le="0.1"} 1000
```

### Integración con Prometheus Server

1. **Configurar Prometheus** (`prometheus.yml`):
```yaml
scrape_configs:
  - job_name: 'cornerapp-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
        labels:
          environment: 'production'
```

2. **Iniciar Prometheus**:
```bash
prometheus --config.file=prometheus.yml
```

3. **Acceder a Prometheus UI**: http://localhost:9090

### Visualización con Grafana

1. **Configurar Grafana**:
   - Agregar Prometheus como data source
   - URL: `http://prometheus:9090`

2. **Crear Dashboards**:
   - Importar dashboards predefinidos
   - Crear dashboards personalizados

## Métricas Disponibles

### HTTP Metrics

```
# Total de requests
cornerapp_http_requests_total{method="GET",endpoint="/api/products",status_code="200"} 1500

# Duración de requests
cornerapp_http_request_duration_seconds{method="GET",endpoint="/api/products"} 0.05

# Requests activos
cornerapp_active_requests 5
```

### Cache Metrics

```
# Cache hits
cornerapp_cache_hits_total{cache_key="products_list"} 800

# Cache misses
cornerapp_cache_misses_total{cache_key="products_list"} 200

# Tamaño del cache
cornerapp_cache_size{cache_key="products_list"} 1024
```

### Error Metrics

```
# Errores HTTP
cornerapp_http_errors_total{method="POST",endpoint="/api/orders",error_type="ServerError"} 5
```

## Queries Prometheus Útiles

### Requests por segundo
```promql
rate(cornerapp_http_requests_total[5m])
```

### Latencia promedio
```promql
rate(cornerapp_http_request_duration_seconds_sum[5m]) / rate(cornerapp_http_request_duration_seconds_count[5m])
```

### Tasa de errores
```promql
rate(cornerapp_http_errors_total[5m]) / rate(cornerapp_http_requests_total[5m]) * 100
```

### Cache hit rate
```promql
rate(cornerapp_cache_hits_total[5m]) / (rate(cornerapp_cache_hits_total[5m]) + rate(cornerapp_cache_misses_total[5m])) * 100
```

## Alertas Recomendadas

### Alta tasa de errores
```yaml
- alert: HighErrorRate
  expr: rate(cornerapp_http_errors_total[5m]) / rate(cornerapp_http_requests_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Alta tasa de errores en la API"
```

### Latencia alta
```yaml
- alert: HighLatency
  expr: histogram_quantile(0.95, cornerapp_http_request_duration_seconds_bucket) > 1
  for: 5m
  annotations:
    summary: "Latencia alta en la API"
```

### Cache hit rate bajo
```yaml
- alert: LowCacheHitRate
  expr: rate(cornerapp_cache_hits_total[5m]) / (rate(cornerapp_cache_hits_total[5m]) + rate(cornerapp_cache_misses_total[5m])) < 0.5
  for: 10m
  annotations:
    summary: "Cache hit rate bajo"
```

## Integración con Docker

### Prometheus en Docker Compose

Agregar a `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: cornerapp-prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  networks:
    - cornerapp-network
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'

grafana:
  image: grafana/grafana:latest
  container_name: cornerapp-grafana
  ports:
    - "3000:3000"
  volumes:
    - grafana-data:/var/lib/grafana
  networks:
    - cornerapp-network
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Mejores Prácticas

### 1. Labels Consistentes

Usar labels consistentes en todas las métricas:
```csharp
_httpRequestsTotal.WithLabels(method, endpoint, statusCode.ToString()).Inc();
```

### 2. Cardinalidad de Labels

Evitar labels con alta cardinalidad (como user IDs):
```csharp
// ❌ Malo - alta cardinalidad
_requests.WithLabels(userId).Inc();

// ✅ Bueno - baja cardinalidad
_requests.WithLabels(userType).Inc();
```

### 3. Histogramas para Latencias

Usar histogramas para métricas de duración:
```csharp
_httpRequestDuration.WithLabels(method, endpoint).Observe(durationSeconds);
```

### 4. Gauges para Valores Actuales

Usar gauges para valores que suben y bajan:
```csharp
_activeRequests.Inc(); // Incrementar
_activeRequests.Dec(); // Decrementar
```

## Troubleshooting

### Métricas no aparecen

1. **Verificar que Prometheus esté habilitado**:
```bash
curl http://localhost:5000/metrics
```

2. **Verificar configuración**:
```json
"Metrics": {
  "Prometheus": {
    "Enabled": true
  }
}
```

3. **Verificar logs**:
```
[INFO] Prometheus HTTP metrics habilitado
[INFO] Prometheus metrics endpoint habilitado en /metrics
```

### Prometheus no puede scrapear

1. **Verificar conectividad**:
```bash
curl http://api:8080/metrics
```

2. **Verificar configuración de Prometheus**:
```yaml
static_configs:
  - targets: ['api:8080']  # Usar nombre del servicio Docker
```

## Referencias

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prometheus-net](https://github.com/prometheus-net/prometheus-net)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
