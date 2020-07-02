# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Join Slack](https://img.shields.io/badge/join-slack-9B69A0.svg)](https://nimbella-community.slack.com/)
[![Twitter](https://img.shields.io/twitter/follow/nimbella.svg?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=nimbella)

A Netlify Build Plugin that extends Netlify Sites to support serverless functions using [Nimbella Cloud](https://nimbella.com/product/platform).

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

All we need is a directory named `packages` at the base of your repository. The plugin will automatically deploy functions inside `packages` and will also create redirect rules so all requests to `/.netlify/functions/*` will be redirected to functions deployed on Nimbella.

For example, let's imagine the following structure:

```
site
├── netlify.toml
├── packages
│   ├── auth
│   │   ├── login.js
│   │   └── logout.js
│   └── todos
│       ├── create.js
│       ├── delete.js
│       ├── list.js
│       └── update.js
└── public
    └── index.html
```

To invoke the function `login`, we would make a request to`https://your-site.com/.netlify/functions/auth/login` (i.e. we need to prefix the package name `auth` to invoke the function `login`.)

Checkout this [example](https://github.com/satyarohith/netlify-plugin-nimbella.netlify.app) to learn more.

You can also change the base prefix `/.netlify/functions/` by specifying it in `netlify.toml`:

```toml
[nimbella]
path = '/api/' # default /.netlify/functions/
```

**How to deploy Netlify Functions to Nimbella Cloud**

You can deploy your existing Netlify Functions to Nimbella Cloud with very minimal changes.

Move the `functions` property under `build` to `nimbella` inside `netlify.toml`.

```diff
[build]
-functions = './functions'
+[nimbella]
+functions = './functions' # Source directory
```

This plugin builds your functions using a modified version of [netlify-lambda](https://github.com/netlify/netlify-lambda). You can get rid of any build steps you're performing on functions since the plugin handles it for you.

All enviroment variables present in the build runtime during Netlify build (except `CI` and `NETLIFY`) are made availabe to the deployed functions on Nimbella Cloud.

**Note:** When you're using `packages` along with functions, make sure to apend "default" to `.netlify/funcitons` to invoke the functions as all functions are deployed under `default` package inside your namespace.

## Support

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
