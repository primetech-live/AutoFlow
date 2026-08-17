# Feature Request & Bug Report: Official Laravel Framework Support in AutoFlow Core

**To**: AutoFlow Core Engineering Team  
**From**: PrimeTech Engineering Team  
**Date**: August 5, 2026  
**Subject**: Issues Encountered During Deployment of Laravel Application (`primetech-crm`) & Proposed Enhancements for AutoFlow Core v1.0.x  

---

## 1. Executive Summary

We recently deployed a production Laravel application using **AutoFlow Core v1.0.1**. During this process, we encountered several critical deployment blockers caused by AutoFlow treating Laravel as a plain PHP application. 

Because AutoFlow generated a generic PHP Dockerfile and entrypoint script, we had to manually fix:
- Incorrect Apache `DocumentRoot` locations leading to `403 Forbidden` errors.
- Container startup crashes (`502 Bad Gateway`) caused by `set -e` in generated shell scripts.
- Database connection timeouts (`504 Gateway Time-out`) during boot-time cache clearing.
- Host-level Nginx blocking of direct IP/phpMyAdmin traffic (`444` drop rules).
- SSL Mixed Content errors (`http://` vs `https://` endpoint generation).

This document serves as a formal post-mortem report and feature proposal for the AutoFlow team to introduce **native Laravel support** in AutoFlow.

---

## 2. Real-World Issues Encountered & Technical Analysis

### Bug 1: Misdetection of Laravel Projects as Plain `PHP`
* **Observation**: AutoFlow CLI logged `App Type: PHP` during `autoflow init` and `autoflow deploy`.
* **Root Cause in Source Code (`src/commands/init.ts`)**:
  ```typescript
  // Line 133 in init.ts:
  // Note: Laravel (artisan) is intentionally excluded...
  else if (fs.existsSync('index.php') || fs.existsSync('public/index.php')) {
    appType = 'php';
  }
  ```
* **Impact**: AutoFlow skipped generating a Laravel-compatible Dockerfile, missing composer dependencies, `public/` directory configuration, and permission handling for `storage/` & `bootstrap/cache/`.

---

### Bug 2: Apache DocumentRoot Pointing to Container Root (`403 Forbidden`)
* **Observation**: Post-deployment HTTP requests returned `403 Forbidden`.
* **Root Cause**: The generated Dockerfile set Apache's `DocumentRoot` to `/var/www/html`. Laravel’s entry point (`index.php`) resides inside `/var/www/html/public`.
* **Required Fix**:
  ```dockerfile
  RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' /etc/apache2/sites-enabled/000-default.conf
  ```

---

### Bug 3: Strict Entrypoint Failure Leading to `502 Bad Gateway`
* **Observation**: Container stopped immediately after deployment, causing Nginx to return `502 Bad Gateway`.
* **Root Cause**: The generated entrypoint script used `set -e` along with commands like `php artisan route:cache` & `php artisan cache:clear`. If database credentials or host connections were not fully initialized at container start, the artisan command exited with a non-zero status code. `set -e` terminated the script before `exec apache2-foreground` could run.
* **Required Fix**: Avoid `set -e` in entrypoint scripts for optional maintenance tasks, or use defensive error handling (`|| true`).

---

### Bug 4: Application Lockup on Database-Backed Cache (`504 Gateway Time-out`)
* **Observation**: Visiting the domain resulted in 60+ seconds of loading followed by `504 Gateway Time-out`.
* **Root Cause**:
  1. Default Laravel configuration often relies on database sessions/cache (`SESSION_DRIVER=database`).
  2. AutoFlow’s initial firewall configuration did not automatically open Docker’s bridge interface (`docker0`) to the host’s MySQL port (`3306`), causing connection attempts from `172.17.0.x` to time out.
* **Required Fix**:
  - AutoFlow should automatically configure UFW on the host during server setup:
    ```bash
    sudo ufw allow in on docker0 to any port 3306
    ```

---

### Bug 5: Overwriting Host Nginx Configurations & Disabling Host Tools (phpMyAdmin Inaccessibility)
* **Observation**: After running `autoflow deploy`, accessing `http://<SERVER_IP>/phpmyadmin/` failed with `ERR_EMPTY_RESPONSE` or Connection Dropped.
* **Root Cause in AutoFlow Architecture**:
  1. During deployment execution, AutoFlow deploys a catch-all block `/etc/nginx/sites-enabled/000-autoflow-catchall` containing `return 444;` for unmapped host IPs.
  2. AutoFlow’s Nginx provisioning step automatically unlinks/disables existing default server blocks (`/etc/nginx/sites-enabled/default`) without checking for pre-existing host services like phpMyAdmin configured on port `8080` / `/phpmyadmin` location block.
* **Required Fix**:
  - AutoFlow should preserve pre-existing host Nginx location blocks (such as `/phpmyadmin`) or avoid unlinking default host configs if direct IP tools are hosted on the server.

---

### Bug 6: Mixed Content Insecure Requests Behind Reverse Proxy
* **Observation**: Chrome blocked login form submissions (`http://management.primetech.live/login_process`) over `https://management.primetech.live/`.
* **Root Cause**: AutoFlow terminates SSL at Nginx and forwards requests to the container over HTTP. Laravel did not recognize `X-Forwarded-Proto: https` by default.
* **Required Fix**: AutoFlow should automatically set `APP_URL=https://<domain>` in `.env` and instruct/inject HTTPS scheme enforcement in `AppServiceProvider.php`.

---

## 3. Evaluation of Current `Dockerfile` for Universal Laravel Projects

The modified `Dockerfile` and `docker-entrypoint.sh` created for this project are functional for basic Laravel web apps. However, for AutoFlow to claim **universal Laravel support**, the following features are still missing:

1. **Lack of Multi-Stage Builds**: Increased Docker image sizes.
2. **Missing OPcache Configuration**: Reduces production PHP execution speed by 40–50%.
3. **No Background Queue / Scheduler Runner**: Apps requiring `php artisan queue:work` or `php artisan schedule:run` cannot run solely under Apache without Supervisor.
4. **Automated `storage:link`**: Storage symlinks are not automatically executed.

---

## 4. Proposed Architectural Changes for AutoFlow Core

We strongly recommend the AutoFlow core team implement the following changes in the next release:

### Recommendation 1: Native `laravel` App Detection
In `D:/Autoflow/src/commands/init.ts`:
```typescript
if (fs.existsSync('artisan') && fs.existsSync('composer.json')) {
  appType = 'laravel';
  log.info('✨ Detected: Laravel Framework');
}
```

### Recommendation 2: Official AutoFlow Laravel Dockerfile Template
```dockerfile
FROM php:8.2-apache

RUN apt-get update && apt-get install -y \
    git curl libpng-dev libonig-dev libxml2-dev zip unzip libzip-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip opcache

RUN a2enmod rewrite

RUN sed -i 's/Listen 80/Listen 3000/' /etc/apache2/ports.conf && \
    sed -i 's/<VirtualHost \*:80>/<VirtualHost *:3000>/' /etc/apache2/sites-enabled/000-default.conf && \
    sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' /etc/apache2/sites-enabled/000-default.conf

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY . .

RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache && \
    chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
```

### Recommendation 3: Defensive `docker-entrypoint.sh` Template
```sh
#!/bin/sh

# Safe clear without crashing container on boot
php artisan config:clear || true
php artisan route:clear || true
php artisan view:clear || true

# Fix permissions
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

exec apache2-foreground
```

---

## 5. Conclusion

AutoFlow is an exceptional deployment tool for Node.js and basic web applications. By incorporating official Laravel detection, Apache `DocumentRoot` adjustments, proxy header awareness, and defensive entrypoints, AutoFlow can deliver a seamless zero-config deployment experience for Laravel developers.
