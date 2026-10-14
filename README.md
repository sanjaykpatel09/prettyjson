# PrettyJSON React starter

A small, responsive JSON formatter built with React and Vite. It can format, minify, and validate JSON, copy the result, and download it as `formatted.json`. Parsing happens in the browser; this starter does not send pasted JSON to a server.

## What to install

1. Install **Node.js LTS** from [nodejs.org](https://nodejs.org/). npm is included with Node.js.
2. Unzip this folder and open a terminal in `prettyjson-react`.
3. Run:

   ```bash
   npm install
   npm run dev
   ```

4. Open the local address printed by Vite (usually `http://localhost:5173`). Press `Ctrl+C` in the terminal to stop the development server.

## Production build

Run `npm run build`. The website files will be generated in the `dist` folder. To preview that build locally, run `npm run preview`.

## Deploy to GitHub Pages

This project is published at <https://sanjaykpatel09.github.io/> from the `sanjaykpatel09.github.io` repository.

1. Push this project to the `main` branch of the `sanjaykpatel09.github.io` repository.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Each push to `main` will build and deploy the site. The published URL will appear in the workflow run and in **Settings → Pages**.

The GitHub Actions workflow automatically uses the root path for this `*.github.io` repository.

## Customize

- Change the page behavior in `src/App.jsx`.
- Change colors and layout in `src/styles.css`.
- Update the browser title and description in `index.html`.

This is a front-end starter only. It does not include hosting, a domain, ads, analytics, payment processing, or a backend. Before publishing, replace the placeholder product branding and add your own privacy, contact, and policy pages. The Google Fonts import is optional; system fonts will be used if the font service is unavailable.
