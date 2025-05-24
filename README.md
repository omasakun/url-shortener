<br>
<div align="center">
  <h1>URL Shortener</h1>
  <p>A simple URL shortener</p>
</div>
<br>
<br>

A simple URL shortener made with Cloudflare Workers.

This project includes a simple web interface to shorten URLs, as well as a REST API for programmatic access.

## Setup

```bash
npm install
npx wrangler kv namespace create URL_SHORTENER
npx wrangler secret put PASSWORD

npm run typegen

npm run dev

npm run deploy
```


## License

This project is licensed under [MIT License](LICENSE).

Copyright 2025 omasakun
