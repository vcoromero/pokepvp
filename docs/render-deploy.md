# Deploy PokePVP backend on Render

This guide walks you through deploying the PokePVP Node.js backend as a **Web Service** on [Render](https://render.com). The app uses MongoDB (Atlas recommended in cloud) and Socket.IO; Render does not provide MongoDB, so you use an external MongoDB (e.g. Atlas).

## Prerequisites

- Render account (dashboard: https://dashboard.render.com)
- Repository pushed to **GitHub** or **GitLab** (Render deploys from Git)
- **MongoDB Atlas** cluster (or any reachable MongoDB) and connection string for production

## 1. Push your code to GitHub/GitLab

If the repo is only local, create a remote and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/pokepvp.git
git push -u origin main
```

## 2. Create a Web Service on Render

1. In the Render dashboard, click **"+ New"** → **"Web Service"**.
2. **Connect your repository**: choose GitHub/GitLab and authorize Render, then select the `pokepvp` repo.
3. If Render doesn’t detect the repo yet, use **"Configure account"** to grant access and try again.

## 3. Configure the Web Service

Use these settings (adjust names if you prefer):

| Field | Value |
|-------|--------|
| **Name** | `pokepvp` (or e.g. `pokepvp-backend`) |
| **Region** | Choose closest to your users (e.g. Oregon, Frankfurt) |
| **Branch** | `main` (or your default branch) |
| **Runtime** | **Node** |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or paid if you need always-on) |

The app already uses `process.env.PORT` and listens on `0.0.0.0`, so no code changes are needed for Render’s port binding.

## 4. Environment variables

In the same Web Service screen, open **"Environment"** / **"Environment Variables"** and add:

| Key | Value | Notes |
|-----|--------|--------|
| `MONGODB_URI` | `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/DB?retryWrites=true&w=majority` | Your **MongoDB Atlas** connection string (use the one for your cluster; replace USER, PASSWORD, CLUSTER, DB). Ensure Atlas allows connections from anywhere (`0.0.0.0/0`) or add Render’s IPs if you use IP allowlist. |
| `POKEAPI_BASE_URL` | `https://pokemon-api-92034153384.us-central1.run.app` | External Pokémon API (no change needed). |
| `CORS_ORIGIN` | Your frontend URL | e.g. `https://your-frontend.onrender.com` or `https://yourdomain.com`. For testing the API only you can leave unset (default in code is `http://localhost:3000`). |

Do **not** set `PORT` — Render sets it automatically.

Optional:

- `NODE_ENV=production` (Render often sets this for you.)

## 5. Deploy

1. Click **"Create Web Service"** (or **"Save"** if you’re editing an existing service).
2. Render will clone the repo, run `npm install`, then `npm start`. The first deploy can take a few minutes.
3. When the deploy succeeds, the **Logs** will show something like:  
   `PokePVP server listening on http://0.0.0.0:XXXX`
4. Your backend URL will be like: **`https://pokepvp-XXXX.onrender.com`** (or the custom name you chose).

## 6. After deploy

- **Health check**: Open `https://YOUR-SERVICE.onrender.com/health` (if you have that route) or the root URL to confirm the app responds.
- **Socket.IO**: Clients must connect to the same host, e.g. `https://YOUR-SERVICE.onrender.com` (Socket.IO will use the path `/socket.io`).
- **Free tier**: The service may spin down after inactivity; the first request after idle can be slow (cold start).
- **Frontend**: Point your frontend’s API/base URL to `https://YOUR-SERVICE.onrender.com` and set `CORS_ORIGIN` to that frontend’s origin so CORS works.

## 7. Troubleshooting

- **Build fails**: Check the **Logs** tab. Typical issues: wrong branch, missing `package.json` or `engines.node`, or a failing `npm install` (e.g. native deps). This project uses Node 18+ and no native build step.
- **App crashes at startup**: Often missing or invalid `MONGODB_URI`. Verify the URI in Atlas (user, password, cluster URL, network access).
- **Socket.IO not connecting**: Ensure the client uses the same base URL (including `https://`) and that you’re not blocking WebSockets. If you use a reverse proxy or custom domain, ensure it supports WebSockets.

## Summary

- **Render**: Web Service, Node, `npm install` + `npm start`.
- **Database**: Use MongoDB Atlas (or another cloud MongoDB) and set `MONGODB_URI`.
- **CORS**: Set `CORS_ORIGIN` to your frontend URL when you have one.

Once the Web Service is green and the URL responds, the backend is “deployed on the cloud” for the bonus point.
