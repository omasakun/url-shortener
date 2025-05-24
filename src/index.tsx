import { zValidator } from "@hono/zod-validator";
import dedent from "dedent";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import type { Child, FC } from "hono/jsx";
import { renderSVG } from "uqr";
import { z } from "zod";

const app = new Hono<{ Bindings: CloudflareBindings }>();

const generateKey = async (URL_SHORTENER: KVNamespace<string>) => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const length = 6;
  while (true) {
    const array = crypto.getRandomValues(new Uint32Array(length));
    const floats = Array.from(array).map((x) => x / 0xffffffff);
    const key = floats.map((x) => chars[Math.floor(x * chars.length)]).join("");
    if (!(await URL_SHORTENER.get(key))) {
      return key;
    }
  }
};

const styles = dedent`
  body {
    margin: 0;
    padding: 3rem 1rem;
    background-color: #f4f4f9;
    color: #333;
  }

  h1 {
    text-align: center;
    color: #444;
  }

  form {
    display: flex;
    gap: 1rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 25rem;
    margin: 2rem auto;
    padding: 2rem;
    background: #fff;
    border-radius: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  input {
    display: block;
    padding: 0.5rem;
    width: 100%;
    border: 1px solid #ccc;
    border-radius: 0.25rem;
    box-sizing: border-box;
  }

  button {
    display: block;
    padding: 0.5rem 1rem;
    color: #fff;
    background-color: #007bff;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }

  a {
    color: #007bff;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  p {
    text-align: center;
  }

  .qr {
    max-width: 16rem;
    margin: 1rem auto;
    display: flex;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    list-style: none;
    max-width: 50rem;
    margin: 2rem auto;
    padding: 2rem;
    background: #fff;
    border-radius: 0.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    word-break: break-word;
  }
`;

const Layout: FC<{ children: Child }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>URL Shortener</title>
      <style>{styles}</style>
    </head>
    <body>{children}</body>
  </html>
);

app.use(
  "/",
  basicAuth({
    verifyUser(username, password, c) {
      return password === c.env.PASSWORD;
    },
  }),
);

app.get(
  "/",
  zValidator(
    "query",
    z.object({
      key: z.string().optional(),
      list: z.string().optional(),
    }),
  ),
  async (c) => {
    const key = c.req.valid("query").key;
    const list = c.req.valid("query").list !== undefined;

    if (key) {
      const shortenURL = new URL(`/${key}`, c.req.url).toString();
      const svg = renderSVG(shortenURL, {
        border: 3,
        whiteColor: "#f4f4f9",
        blackColor: "#000",
      });

      return c.html(
        <Layout>
          <h1>URL Shortener</h1>
          <p>
            <a href={shortenURL}>{shortenURL}</a>
          </p>
          <div class="qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <p>
            <a class="button" href="/">
              Go back
            </a>
          </p>
        </Layout>,
      );
    }

    if (list) {
      const keys = await c.env.URL_SHORTENER.list();
      const items = await Promise.all(
        keys.keys.map(async (item) => {
          const data = await c.env.URL_SHORTENER.get(item.name);
          if (!data) return null;

          const { url, timestamp } = JSON.parse(data);

          return (
            <li key={item.name}>
              <a href={`/?key=${item.name}`}>{decodeURI(url)}</a>
            </li>
          );
        }),
      );

      return c.html(
        <Layout>
          <h1>URL Shortener</h1>
          {items.length === 0 ? (
            <p>No shortened URLs found.</p>
          ) : (
            <>
              <p>Click on the URL to view the shortened link:</p>
              <ul>{items}</ul>
            </>
          )}
          <p>
            <a class="button" href="/">
              Go back
            </a>
          </p>
        </Layout>,
      );
    }

    return c.html(
      <Layout>
        <h1>URL Shortener</h1>
        <p>Enter a URL to shorten it:</p>
        <form action="/" method="post">
          <input
            type="url"
            name="url"
            required
            placeholder="https://example.com"
          />
          <input
            type="text"
            name="key"
            placeholder="Custom key (optional)"
            pattern="[a-z0-9]*"
            />
          <button type="submit">Shorten</button>
        </form>
        <p>
          <a href="/?list">List shortened URLs</a>
        </p>
      </Layout>,
    );
  },
);

app.post(
  "/",
  zValidator(
    "form",
    z.object({
      url: z.string().url(),
      key: z.string().regex(/^[a-z0-9]+$/).optional(),
    }),
  ),
  async (c) => {
    const { url, key: customKey } = c.req.valid("form");

    if (customKey && (await c.env.URL_SHORTENER.get(customKey))) {
      return c.html(
        <Layout>
          <h1>URL Shortener</h1>
          <p>
            The custom key "{customKey}" is already in use. Please choose another key.
          </p>
          <p>
            <a class="button" href="/">
              Go back
            </a>
          </p>
        </Layout>,
      );
    }

    const key = customKey || (await generateKey(c.env.URL_SHORTENER)); // Use custom key if provided

    const timestamp = new Date().toISOString();
    const data = JSON.stringify({ url, timestamp });

    await c.env.URL_SHORTENER.put(key, data);
    return c.redirect(`/?key=${key}`);
  },
);

app.get("/:key", async (c) => {
  const key = c.req.param("key");
  const data = await c.env.URL_SHORTENER.get(key);

  if (!data) return c.notFound();

  const { url } = JSON.parse(data);
  return c.redirect(url);
});

export default app;
