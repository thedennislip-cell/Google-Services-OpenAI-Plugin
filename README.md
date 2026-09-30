# Google Services

A mobile-friendly Next.js dashboard for viewing your own Gmail messages and Google Drive file metadata. It starts disconnected and does not show fake inbox or file data.

## Implemented

- Responsive dashboard designed for iPad and mobile browsers.
- Google OAuth authorization-code flow with state validation and PKCE.
- HTTP-only, Secure, SameSite=Lax cookies.
- Gmail read-only search/list endpoint.
- Drive metadata-only search/list endpoint.
- AES-256-GCM encrypted token storage in Supabase, server-side only.
- Token refresh, disconnect, and revoke flow.
- Baseline security headers.

The app does not send email, edit or delete files, or change Drive sharing permissions.

## 1. Deploy to Vercel

Import this repository into Vercel as a Next.js project. The build command is `npm run build`.

## 2. Create the Supabase table

Create a Supabase project, open SQL Editor, and run [supabase/schema.sql](supabase/schema.sql). Copy the project URL and service-role key into Vercel environment variables. The service-role key bypasses RLS, so it must never be exposed to client-side code or committed.

## 3. Configure Google Cloud OAuth

In Google Auth Platform, create a Web application OAuth client. The redirect URI must exactly match the callback URI, including scheme, hostname, path, and trailing slash.

After Vercel has deployed the app, set:

`GOOGLE_REDIRECT_URI=https://YOUR-DEPLOYED-DOMAIN/api/auth/google/callback`

Add that exact same URL under **Authorized redirect URIs** in Google Cloud. Do not use a guessed domain.

If the OAuth app is in Testing, add the Google account you will use under Test users. Workspace administrators can block access, and this app cannot override their policies.

## 4. Set environment variables in Vercel

Copy the values into Vercel Project Settings → Environment Variables. Do not commit secrets.

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `APP_ENCRYPTION_KEY` — use a long, random server-only secret
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after setting or changing environment variables.

## 5. Test

1. Open the deployed URL in Safari.
2. Select **Connect Google account**.
3. Review the Google consent screen and approve only if you recognize the app and requested permissions.
4. Test Gmail search and Drive file listing.
5. Test **Disconnect Google account**.

Requested scopes are OpenID/email identity, Gmail read-only, and Drive metadata read-only. Google may apply additional verification or Workspace administrator restrictions. The OAuth flow is not ready until real credentials and Supabase configuration are added and tested.

## Security notes

- Never place OAuth client secrets, Supabase service-role keys, or Google tokens in client code, local storage, screenshots, or GitHub.
- Tokens are encrypted before storage using AES-256-GCM. The encryption key is read only on the server.
- Keep the repository private if you later add project-specific configuration.
- If a Google account is blocked by a Workspace administrator, use an account you are authorized to connect or ask the administrator about access.
