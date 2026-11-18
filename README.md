# Basti Eats

A small shared board for team food requests. Your own requests for today appear below the add field and in the shared list. Today and History both offer Requests and Payments tabs. Requests groups matching items and shows their quantities. Payments shows one order per person per date, with a single payment toggle for your own order. Adding another request on the same date marks that order unpaid. Click a row to see its details.

The request field remembers your last text in local storage. Click it to see distinct requests from Today and History, newest first, or type to filter the list.

The theme button next to Log out cycles through Light, Dark, and Auto. Auto follows your device setting. Your choice is remembered in this browser.

Basti Eats can be installed from a supported browser over HTTPS or localhost. After the first visit, the app interface is available offline. Viewing shared requests and submitting changes require a connection.

## Run locally

With Node.js 22, run:

```sh
npm run dev
```

Open <http://127.0.0.1:3000>. The dev server restarts when backend code changes. The first run creates `.data/requests.json` with a few sample entries. New requests and payment changes persist across restarts. Your name is remembered in this browser's local storage. Choose **Log out** to clear it and enter another name.

The default timezone is `Europe/Berlin`. To change it, set `BOARD_TIME_ZONE` in `.env` locally or in the environment on Vercel.

## Deploy to Vercel

1. Import the repository in Vercel using the **Other** framework preset. The project serves `public/` directly and uses the Node.js Function at `/api/board`.
2. Connect [Upstash Redis](https://vercel.com/marketplace/upstash) to the project. The app uses the integration's `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables. For a direct Upstash connection, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` instead. Apply the credentials to the Vercel environments you plan to use.
3. Deploy. The Redis board starts empty. To test against Redis locally, put the same variables in `.env` and run `npm run dev`.

Anyone with the board URL can enter any name. Payment controls match names without regard to capitalization or extra spaces. Use a distinct name if someone on the team shares yours.
