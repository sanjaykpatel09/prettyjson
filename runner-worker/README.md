# Java runner

Java execution uses JDoodle through a Cloudflare Worker so that the JDoodle client secret stays server-side. The runner supports Java 8, 11, 17, and 22; Python continues to run on Wandbox.

Until the Worker URL is configured in the site build, Java automatically uses Wandbox's Java 22 compiler so the runner remains usable during setup.

## Deploy the Worker

1. Create JDoodle Compiler API credentials and a Cloudflare account. Do not put the JDoodle secret in the site or any `VITE_` variable.
2. Check JDoodle's current Java language/version list for the `versionIndex` of Java 8, 11, 17, and 22. These are API catalog indexes, not Java version numbers, and must not be guessed.
3. Install/use Wrangler 4.36.0 or later, and sign in:

   ```sh
   npx wrangler@latest login
   ```

4. Edit `wrangler.toml`:
   - Set `ratelimits[0].namespace_id` to an integer unique within your Cloudflare account.
   - Set `ALLOWED_ORIGINS` to the exact origins of the deployed site and any local development site. An origin includes its scheme and port; add your computer's LAN origin (for example, `http://192.168.1.6:5173`) when testing from another device over Wi-Fi.
   - Add `JAVA_VERSION_INDEX_8`, `JAVA_VERSION_INDEX_11`, `JAVA_VERSION_INDEX_17`, and `JAVA_VERSION_INDEX_22` to `[vars]`, using the indexes obtained in step 2.
5. Set the JDoodle credentials as Worker secrets. Wrangler prompts for the values:

   ```sh
   npx wrangler@latest secret put JDOODLE_CLIENT_ID --config runner-worker/wrangler.toml
   npx wrangler@latest secret put JDOODLE_CLIENT_SECRET --config runner-worker/wrangler.toml
   ```

6. Deploy:

   ```sh
   npx wrangler@latest deploy --config runner-worker/wrangler.toml
   ```

   Wrangler prints the Worker URL, usually `https://prettyjson-java-runner.<account-subdomain>.workers.dev`.

## Connect the site

- For local development, copy `.env.example` to `.env.local`, set `VITE_JAVA_RUNNER_URL` to the Worker URL, and restart Vite.
- In GitHub repository **Settings → Secrets and variables → Actions → Variables**, add `VITE_JAVA_RUNNER_URL` with the Worker URL. Run the GitHub Pages deployment workflow again to rebuild the site.

## Test locally

Copy `.dev.vars.example` to `runner-worker/.dev.vars`, replace the JDoodle credentials and all four version indexes, then run:

```sh
npx wrangler@latest dev --config runner-worker/wrangler.toml
```

Do not commit `.dev.vars`. It is ignored by Git.

The Worker allows five runs per IP address per minute and limits source and stdin size. CORS origin checks are not authentication: the Worker endpoint is public and can be called outside a browser. The rate limit helps protect JDoodle credits but is not a guaranteed account-wide quota. Review your JDoodle plan and usage; each run consumes API credits.

Java source and stdin are sent to JDoodle for execution. Do not run code containing secrets or submit sensitive data.
