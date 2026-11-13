# Connect trip albums to Cloudflare R2

Trip albums read R2 when opened or when **Load album** is clicked. They do not run a background sync and do not need a Worker.

Add these values to `server/.env` and restart TREK:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-R2-account-api-token
R2_BUCKET_NAME=world-travel-media
```

Use a Cloudflare API token with **Object Read & Write** permission scoped to `world-travel-media`. The current Cloudflare API token value goes in `CLOUDFLARE_API_TOKEN`. The S3 Access Key ID and Secret Access Key are not used by this integration. Never put credentials in a client `.env` file or commit them.

TREK calls Cloudflare's authenticated R2 API from the server and keeps object reads behind trip membership checks. The API currently limits each upload to 300 MB, so videos above that size are rejected. This is intended for occasional album browsing and uploads; use R2's S3 API with multipart uploads if larger videos or high-volume transfers are needed.
