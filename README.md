# ☁️  Shorty: A Cloudflare Workers-powered link shortener

This is a link shortener that runs as a [Cloudflare Worker](https://workers.cloudflare.com/).

1. Ensure Wrangler is installed on your local machine and authenticate with Cloudflare:

    ```shell
    $ npm i @cloudflare/wrangler -g
    $ wrangler login
    ```

2. Create the Workers KV namespace for the shortener:

    ```shell
    $ wrangler kv:namespace create "SHORTY"
    $ wrangler kv:namespace create "SHORTY" --preview
    ```

    Copy the `id` you get in the terminal output to `wrangler.toml` in place of `ID_HERE`, and copy the `preview_id` you get in the terminal output in place of `PREVIEW_ID_HERE`.

3. Deploy the Worker: `wrangler publish`.
