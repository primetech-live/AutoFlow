# Framework Support & Detection

AutoFlow features an intelligent Framework Detection Engine that automatically scans your codebase and determines the optimal build sequence, container configuration, and routing rules without requiring you to write a `Dockerfile`.

---

## Node.js Projects
**Trigger:** Detection of `package.json`.
**Workflow:**
1. Configures a lightweight Node Alpine Linux base image.
2. Installs dependencies using `npm ci` or `yarn install` based on lockfile detection.
3. Runs the production build scripts (if defined).
4. Sets the default listening target port (usually 3000) and executes the start script.

## Modern Web Frameworks (Next.js, Nuxt, Remix)
**Trigger:** Detection of framework-specific dependencies in `package.json`.
**Workflow:**
1. Configures multi-stage build steps to optimize page caching.
2. Compiles static assets in the build stage.
3. Copies only the necessary `.next` or `.nuxt` project assets into the runtime container.
4. Exposes the application port for Server-Side Rendering (SSR) processes.

## Python Applications (Django, Flask, FastAPI)
**Trigger:** Detection of `requirements.txt` or `Pipfile`.
**Workflow:**
1. Configures a slim Python runtime environment.
2. Installs dependencies via `pip`.
3. If database libraries (e.g., `psycopg2`) are detected, AutoFlow prepares persistent storage volume maps to avoid data loss on container restarts.
4. Starts the application gateway (e.g., Gunicorn or Uvicorn).

## Go (Golang)
**Trigger:** Detection of `go.mod`.
**Workflow:**
1. Employs a strict multi-stage build.
2. **Stage 1 (Builder):** Uses a heavy Go SDK image to compile the binary.
3. **Stage 2 (Runtime):** Copies *only* the compiled binary into a scratch/alpine container. This reduces the final image size from ~800MB to less than 20MB, dramatically improving deployment speed.

## Java Enterprise Applications
**Trigger:** Detection of `pom.xml` (Maven) or `build.gradle`.
**Workflow:**
1. Configures base build layers using Maven or Gradle images.
2. Runs the packaging tools to generate `.jar` or `.war` archive files.
3. Copies the generated executable into a lightweight OpenJRE runtime container and routes traffic.

## Ruby Web Applications (Rails, Sinatra)
**Trigger:** Detection of `Gemfile`.
**Workflow:**
1. Installs system build dependencies (e.g., `libpq-dev` for Postgres).
2. Runs `bundle install`.
3. Configures database link variables, runs asset precompilation, and starts the Puma server.

## PHP Web Applications
**Trigger:** Presence of `.php` page templates without a Node/Python package manager.
**Workflow:**
1. Configures an Apache/PHP or PHP-FPM web server base image.
2. Enables `.htaccess` redirection rules.
3. Shifts the internal container listening port to prevent conflicts with the host Nginx proxy.

## Static HTML / Frontend
**Trigger:** `index.html` found in the root without any developer package files.
**Workflow:**
1. AutoFlow copies the files directly to a lightweight Nginx web proxy container.
2. It hosts the static distribution folder and sets up port redirection rules to serve the content extremely fast.
