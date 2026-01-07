# CI/CD Pipeline - GitHub Actions

## Descripción

Este documento describe el sistema de CI/CD implementado con GitHub Actions para automatizar tests, builds y deployments de CornerApp API.

## ¿Qué es CI/CD?

- **CI (Continuous Integration)**: Integración continua - ejecuta tests automáticamente en cada commit
- **CD (Continuous Deployment)**: Deployment continuo - despliega automáticamente a producción

## Workflows Implementados

### 1. CI/CD Pipeline Principal (`ci-cd.yml`)

Se ejecuta en cada push y pull request a `main` o `develop`.

**Jobs**:
1. **Build and Test**: Compila, ejecuta tests y genera reportes de cobertura
2. **Build Docker**: Construye imagen Docker (solo en push)
3. **Security Scan**: Escanea vulnerabilidades con Trivy
4. **Code Quality**: Análisis de código con SonarCloud (opcional)

### 2. Deploy Workflow (`deploy.yml`)

Se ejecuta manualmente o en push a `main` con tags `v*`.

**Características**:
- Deploy a staging o production
- Soporte para Azure Web App
- Deploy via SSH
- Notificaciones de deployment

### 3. Docker Build (`docker-build.yml`)

Construye y publica imágenes Docker a GitHub Container Registry.

**Características**:
- Multi-platform (amd64, arm64)
- Cache de builds
- Tags automáticos por branch, PR, semver

### 4. PR Checks (`pr-checks.yml`)

Validaciones específicas para Pull Requests.

**Checks**:
- Formato de código
- Tests
- Comentarios automáticos en PR

## Configuración

### Secrets Requeridos (GitHub)

Configurar en: `Settings > Secrets and variables > Actions`

#### Para Docker Registry
```
DOCKER_USERNAME=tu-usuario
DOCKER_PASSWORD=tu-password
DOCKER_REGISTRY=registry-url (opcional)
```

#### Para Azure Deployment
```
AZURE_WEBAPP_NAME=nombre-app
AZURE_WEBAPP_PUBLISH_PROFILE=perfil-publicacion
```

#### Para SSH Deployment
```
SSH_HOST=servidor.com
SSH_USERNAME=usuario
SSH_PRIVATE_KEY=clave-privada
```

#### Para SonarCloud (Opcional)
```
SONAR_TOKEN=token-sonarcloud
```

#### Para Notificaciones
```
SLACK_WEBHOOK_URL=url-webhook-slack
```

### Environments

Configurar en: `Settings > Environments`

- **staging**: Ambiente de staging
- **production**: Ambiente de producción

## Uso

### Automático

Los workflows se ejecutan automáticamente:
- **Push a main/develop**: Ejecuta CI/CD completo
- **Pull Request**: Ejecuta PR checks
- **Tag v***: Ejecuta deployment

### Manual

```bash
# Deploy manual desde GitHub Actions
1. Ir a Actions > Deploy to Production
2. Click "Run workflow"
3. Seleccionar environment (staging/production)
4. Click "Run workflow"
```

## Estructura de Workflows

```
.github/
└── workflows/
    ├── ci-cd.yml          # Pipeline principal
    ├── deploy.yml         # Deployment
    ├── docker-build.yml   # Docker builds
    └── pr-checks.yml      # PR validaciones
```

## Servicios en CI

Los workflows incluyen servicios Docker para tests:

### SQL Server
```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    env:
      SA_PASSWORD: TestPassword123!
```

### Redis
```yaml
services:
  redis:
    image: redis:7-alpine
```

## Reportes Generados

### Test Results
- Ubicación: `TestResults/`
- Formato: Cobertura de código
- Retención: 30 días

### Coverage Report
- Ubicación: `CoverageReport/`
- Formato: HTML + Cobertura
- Retención: 30 días

### Security Scan
- Herramienta: Trivy
- Formato: SARIF
- Integración: GitHub Security

## Ejemplos de Uso

### Ver Estado de CI/CD

```bash
# En GitHub
1. Ir a la pestaña "Actions"
2. Ver workflows ejecutándose/completados
3. Click en un workflow para ver detalles
```

### Ver Test Results

```bash
# En GitHub Actions
1. Abrir un workflow run
2. Click en "build-and-test" job
3. Descargar artifact "test-results"
```

### Ver Coverage

```bash
# En GitHub Actions
1. Abrir un workflow run
2. Click en "build-and-test" job
3. Descargar artifact "coverage-report"
4. Abrir index.html en navegador
```

## Troubleshooting

### Tests Fracasan en CI

1. **Verificar variables de entorno**:
```yaml
ConnectionStrings__DefaultConnection: 'Server=localhost,1433;...'
ConnectionStrings__Redis: 'localhost:6379'
```

2. **Verificar servicios Docker**:
   - SQL Server debe estar healthy
   - Redis debe estar healthy

3. **Ver logs del workflow**:
   - Click en el job fallido
   - Revisar logs de cada step

### Docker Build Falla

1. **Verificar Dockerfile**:
```bash
docker build -f CornerApp.API/Dockerfile .
```

2. **Verificar contexto**:
   - El contexto debe ser `./backend-csharp`

### Deployment Falla

1. **Verificar secrets**:
   - Todos los secrets requeridos deben estar configurados

2. **Verificar permisos**:
   - El token debe tener permisos para deployment

3. **Verificar conectividad**:
   - SSH host debe ser accesible
   - Azure credentials deben ser válidas

## Mejores Prácticas

### 1. Branch Protection

Configurar en: `Settings > Branches`

- Requerir que los tests pasen antes de merge
- Requerir review de código
- Bloquear force push

### 2. Secrets Management

- **Nunca** commitear secrets en código
- Usar GitHub Secrets para valores sensibles
- Rotar secrets regularmente

### 3. Test Coverage

- Mantener cobertura > 80%
- Agregar tests para nuevas funcionalidades
- Revisar reportes de cobertura regularmente

### 4. Deployment Strategy

- **Staging**: Deploy automático en push a `develop`
- **Production**: Deploy manual o con tags `v*`
- **Rollback**: Mantener imágenes Docker anteriores

## Integración con Otros Servicios

### SonarCloud

1. Crear cuenta en SonarCloud
2. Configurar proyecto
3. Agregar `SONAR_TOKEN` a secrets
4. El análisis se ejecutará automáticamente

### Slack Notifications

1. Crear webhook en Slack
2. Agregar `SLACK_WEBHOOK_URL` a secrets
3. Recibir notificaciones de deployments

### Azure DevOps

Puede integrarse con Azure DevOps pipelines:
```yaml
- name: Trigger Azure Pipeline
  uses: azure/pipelines-action@v1
  with:
    azure-devops-project-url: ${{ secrets.AZURE_DEVOPS_URL }}
    azure-pipeline-name: 'CornerApp-Pipeline'
```

## Referencias

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [.NET GitHub Actions](https://github.com/actions/setup-dotnet)
- [Docker GitHub Actions](https://github.com/docker/build-push-action)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy-action)
