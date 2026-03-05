# Contributing to Collective App

Thank you for your interest in contributing to Collective App! This project is community-driven and we welcome contributions of all kinds.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/CollectiveApp.git
   cd CollectiveApp
   ```
3. **Install dependencies:**
   ```bash
   nvm use  # uses the Node version in .nvmrc
   npm install
   cd functions && npm install && cd ..
   ```
4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   cp functions/.env.example functions/.env
   ```
   Fill in your own Firebase and Cloudinary credentials.

5. **Run the app:**
   ```bash
   npx expo start
   ```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run the linter before committing:
   ```bash
   npm run lint
   ```
4. Commit with a descriptive message:
   ```bash
   git commit -m "Add: brief description of what you added"
   ```
5. Push to your fork and open a Pull Request against `main`

## Code Style

- **Linting:** We use ESLint. Run `npm run lint` and fix all warnings before submitting.
- **Formatting:** We use Prettier. Run `npx prettier --write .` to auto-format.
- **Font:** The app uses RobotoMono throughout. All font references use the `fonts` object from `src/theme/typography.js`.
- **Colors:** Use the `colors` object from `src/theme` rather than hardcoding color values.
- **Sounds:** Use the `playClick` / `playSwoosh` helpers from `src/services/soundService.js` for UI feedback.

## Project Structure

- `src/screens/` - Screen components organized by feature
- `src/components/` - Reusable UI components
- `src/services/` - Firebase and API service functions
- `src/contexts/` - React Context providers (auth, theme)
- `src/config/` - App configuration files
- `src/theme/` - Colors, typography, and styling constants
- `functions/` - Firebase Cloud Functions (Cloudinary signing, notifications)

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include a clear description of what changed and why
- Add screenshots for any UI changes
- Make sure `npm run lint` passes with 0 warnings
- Test on a physical device or emulator before submitting

## Reporting Bugs

Open an issue on GitHub with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Device/OS information
- Screenshots if applicable

## Feature Requests

Open an issue with the `enhancement` label describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Questions?

Reach out at collective.app@proton.me or open a discussion on GitHub.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
