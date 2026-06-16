# Contributing to AutoFlow

First off, thank you for taking the time to contribute! Contributions are what make the open-source community such an amazing place to learn, inspire, and create.

---

## 📜 Table of Contents

1. [Code of Conduct](#-code-of-conduct)
2. [Getting Started](#-getting-started)
3. [Coding Guidelines](#-coding-guidelines)
4. [Testing Policies](#-testing-policies)
5. [Pull Request Process](#-pull-request-process)

---

## 🤝 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, professional, and collaborative in all communication and code reviews.

---

## 🚀 Getting Started

To set up a local development environment:

1. **Fork and Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/autoflow.git
   cd autoflow
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Build Commands:**
   - Compile the standalone CLI wrapper (`dist/cli.js`):
     ```bash
     npm run build:cli
     ```
   - Compile the entire project (UI + CLI):
     ```bash
     npm run build
     ```
   - Package the installers locally:
     ```bash
     npm run dist
     ```

---

## 💻 Coding Guidelines

To maintain code quality and production-grade reliability, please follow these principles:

### 1. TypeScript & Type Safety
- Always specify strict parameter and return types. Avoid the use of `any` unless absolutely necessary.
- Prefer interface declarations over type aliases for public APIs.

### 2. Asynchronous I/O
- Do not perform blocking synchronous filesystem operations (`fs.existsSync`, `fs.readFileSync`) on the main thread, especially inside Electron IPC handlers or recursive walks.
- Use `fs.promises` APIs for async non-blocking operations.

### 3. Security & Input Sanitization
- All shell command values sent over SSH must be sanitized using `escapeShellArg` from `src/utils/shell.ts`.
- Never print, log, or leak sensitive Vault secrets, credentials, or API tokens to console outputs or diagnostics files. Ensure log filters are used.

### 4. Code Duplication
- Keep code DRY. Always consolidate core configuration loading or secure key derivation utilities into central helper libraries (`src/core/config.ts`, `src/core/vault.ts`).

---

## 🧪 Testing Policies

We enforce strict test coverage for all logic-modifying pull requests.

- **Unit Tests:** Located in `tests/unit/core.test.ts`. Use Jest for behavioral validation (e.g. key encryption, path containments, timeouts, and state locks).
- **Integration Tests:** Located in `tests/integration/deploy.test.ts`.
- **Running Tests:**
  ```bash
  npm test
  ```
- All tests must pass cleanly before submitting your changes.

---

## 📥 Pull Request Process

1. Create a descriptive branch for your changes:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Commit your modifications with clear, semantic commit messages (e.g. `feat: add container prune flags`, `fix: sanitize remote directory paths`).
3. Push to your branch and open a Pull Request against the `main` branch.
4. Ensure the CI checks run and pass successfully. Once reviewed, your PR will be merged!
