# AutoFlow Core Enhancement Proposal: Automatic Laravel Deployment Initialization Specifications (v2)

**To**: AutoFlow Core Engineering Team  
**From**: PrimeTech Engineering Team  
**Date**: August 17, 2026  
**Subject**: Automatic Generation & Configuration Specifications for Laravel Applications in `autoflow init` (`fix_proposal2.md`)

---

## 1. Executive Summary

During the deployment of production Laravel applications (e.g., `primetech-crm`), several critical configuration patterns were identified that are necessary for seamless, error-free deployment behind reverse proxies (Nginx + SSL), handling upload permissions, multi-service containers, and persistent storage.

This document details the exact changes made to:
1. **`Dockerfile`**
2. **`docker-entrypoint.sh`**
3. **`AppServiceProvider.php`**
4. **`autoflow.config.json`**

When a developer runs `autoflow init` on a Laravel codebase, AutoFlow CLI should automatically generate/inject these configurations so that deployment works smoothly out-of-the-box without manual intervention.

---

## 2. Component Specifications & Requirements

### Component 1: `Dockerfile` (Laravel Optimized Template)

#### Changes Made & Technical Rationale:
* **PHP Extensions & Node.js Runtime**: Installs `pdo_mysql`, `mbstring`, `exif`, `pcntl`, `bcmath`, `gd`, `zip`, along with `nodejs` and `npm` for bundled microservices (e.g. Node.js WhatsApp service).
* **Apache Configuration**: Re-routes Apache `Listen 80` -> `Listen 3000` and sets `DocumentRoot` strictly to `/var/www/html/public`.
* **Composer Dependency Resolution**: Automated non-dev composer install (`composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev`).
* **Uploads & Cache Directory Provisioning**: Explicitly creates `/var/www/html/public/uploads`, `/var/www/html/public/assets/uploads`, and `/var/www/html/storage/app/public` with recursive `chown -R www-data:www-data` and `chmod -R 777` permissions to prevent `mkdir(): Permission denied` runtime errors when web server handles file uploads.

#### Template Output for `Dockerfile`:
```dockerfile
FROM php:8.2-apache

# Install System Dependencies & PHP Extensions required by Laravel + Node.js
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    nodejs \
    npm \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Enable Apache mod_rewrite for clean URLs
RUN a2enmod rewrite

# Update Apache Port (3000) and DocumentRoot (/var/www/html/public)
RUN sed -i 's/Listen 80/Listen 3000/' /etc/apache2/ports.conf && \
    sed -i 's/<VirtualHost \*:80>/<VirtualHost *:3000>/' /etc/apache2/sites-enabled/000-default.conf && \
    sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' /etc/apache2/sites-enabled/000-default.conf && \
    echo "UseCanonicalName Off" >> /etc/apache2/apache2.conf && \
    echo "UseCanonicalPhysicalPort Off" >> /etc/apache2/apache2.conf

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy all project files
COPY . .

# Install PHP dependencies via Composer
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Copy startup entrypoint script & make executable
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set initial permissions for Laravel storage, cache, and uploads directories
RUN mkdir -p /var/www/html/public/uploads /var/www/html/public/assets/uploads /var/www/html/storage/app/public && \
    chown -R www-data:www-data /var/www/html && \
    chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/public/uploads /var/www/html/public/assets

EXPOSE 3000

# Set entrypoint to execute startup commands on every container start/restart
ENTRYPOINT ["docker-entrypoint.sh"]
```

---

### Component 2: `docker-entrypoint.sh` (Safe Container Boot Script)

#### Changes Made & Technical Rationale:
* **Safe Non-Blocking Cache Clears**: Avoids database connection deadlocks during container boot by running `artisan config:clear`, `view:clear`, and `route:clear` with `|| true` guards.
* **Boot-Time Permission Enforcement**: Re-executes `mkdir -p` and permission assignments (`chown` / `chmod -R 777`) on mounted volumes so host-mounted directories remain writable by `www-data`.
* **Microservice Execution Support**: Allows background processes (e.g. Node.js microservices) to start prior to invoking `exec apache2-foreground`.

#### Template Output for `docker-entrypoint.sh`:
```sh
#!/bin/sh

# Safe file/config clear (does NOT try connecting to Database during boot)
php artisan config:clear || true
php artisan view:clear || true
php artisan route:clear || true

# Re-apply correct ownership & permissions on volumes
mkdir -p /var/www/html/public/uploads /var/www/html/public/assets/uploads /var/www/html/storage/app/public
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/public/uploads /var/www/html/public/assets
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/public/uploads /var/www/html/public/assets

# Start Apache in foreground
exec apache2-foreground
```

---

### Component 3: `AppServiceProvider.php` (HTTPS Force & Asset Helpers)

#### Changes Made & Technical Rationale:
* **SSL / Mixed Content Prevention**: When running behind an Nginx SSL reverse proxy, Laravel often generates `http://` asset and form action URLs. Adding proxy header checks (`x-forwarded-proto === 'https'`, `HTTP_X_FORWARDED_PROTO`, non-localhost host headers) and triggering `\Illuminate\Support\Facades\URL::forceScheme('https')` guarantees 100% HTTPS asset loading.
* **Global View Sharing**: Shares standard asset paths (`actual_url`, `img_path`) globally across views and configs.

#### Code Snippet to Inject into `app/Providers/AppServiceProvider.php`:
```php
public function boot(): void
{
    if (
        request()->header('x-forwarded-proto') === 'https' ||
        (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
        (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ||
        str_starts_with(config('app.url'), 'https://') ||
        (request()->server('HTTP_HOST') && !in_array(explode(':', request()->server('HTTP_HOST'))[0], ['127.0.0.1', 'localhost']))
    ) {
        \Illuminate\Support\Facades\URL::forceScheme('https');
    }

    view()->share('actual_url', asset('assets'));
    config(['app.actual_url' => asset('assets')]);

    view()->share('img_path', asset('assets/uploads'));
    config(['app.img_path' => asset('assets/uploads')]);
}
```

---

### Component 4: `autoflow.config.json` (Persistent Storage Volume Specification)

#### Changes Made & Technical Rationale:
* **Persistent Uploads & Storage Volumes**: `autoflow init` must automatically detect and add upload directories (`/var/www/html/public/uploads`, `/var/www/html/public/assets/uploads`) and Laravel storage (`/storage`) into `volumes` array so user files and uploaded media persist across container rebuilds.

#### Output Specification for `autoflow.config.json`:
```json
{
  "projectName": "<project-name>",
  "gitRepo": "<git-repo-url>",
  "domain": "<domain-name>",
  "appType": "laravel",
  "deploymentType": "docker",
  "mode": "domain",
  "branch": "main",
  "strictCI": false,
  "volumes": [
    "/database",
    "/storage",
    "/var/www/html/public/uploads",
    "/var/www/html/public/assets/uploads"
  ]
}
```

---

## 3. Implementation Workflow for `autoflow init` Command

When a user executes `autoflow init` in a repository:

1. **Framework Detection**: Check for `composer.json` containing `"laravel/framework"` or presence of `artisan`.
2. **Set `appType`**: Automatically set `"appType": "laravel"` in `autoflow.config.json`.
3. **Generate Files**:
   - Write `Dockerfile` with DocumentRoot set to `/var/www/html/public`.
   - Write `docker-entrypoint.sh` with non-blocking artisan commands and directory permissions.
   - Inject HTTPS proxy detection into `app/Providers/AppServiceProvider.php`.
   - Configure default persistence volumes in `autoflow.config.json`.
4. **Outcome**: Clean, smooth, zero-downtime deployment on first `autoflow deploy`.
