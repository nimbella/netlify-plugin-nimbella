# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Join Slack](https://img.shields.io/badge/join-slack-9B69A0.svg)](https://nimbella-community.slack.com/)
[![Twitter](https://img.shields.io/twitter/follow/nimbella.svg?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=nimbella)

A Netlify Build Plugin that extends Netlify Functions to support different runtimes using [Nimbella Cloud](https://nimbella.com/product/platform).

- [Setup](#setup)
- [Usage](#usage)
- [Support](#support)
- [License](#license)

## Setup

Use Netlify addon `nimbella` to connect your Netlify site to Nimbella.

1. **Add the Nimbella Add-on for Netlify**

   Run the below at the base of your local project directory linked to your Netlify site.

   ```sh
   $ netlify addons:create nimbella
   ```

2. **Add Nimbella Build Plugin to Your Netlify Site**

   Append the below to your `netlify.toml`.

   ```toml
   [[plugins]]
   package = "netlify-plugin-nimbella"
   ```

## Usage

This Build Plugin brings Nimbella Cloud to Netlify sites.

When you've a `packages` directory at base of your repository, this plugin will automatically deploy them and will create redirect rules so all requests to `/.netlify/functions/*` will be redirected to functions deployed on Nimbella.

**Deploy Existing Netlify Functions to Nimbella Cloud**

Remove functions property from `[build]` and add it under `[nimbella]` in your `netlify.toml`.

```diff
[build]
-  functions = "functions/"
+ [nimbella]
+  functions = "functions/"
```

Checkout this [example](https://github.com/satyarohith/netlify-plugin-nimbella.netlify.app) to learn more.

## Support

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
