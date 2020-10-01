# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Join Slack](https://img.shields.io/badge/join-slack-9B69A0.svg)](https://nimbella-community.slack.com/)
[![Twitter](https://img.shields.io/twitter/follow/nimbella.svg?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=nimbella)

A Netlify Build Plugin that extends Netlify Sites with support for portable and stateful serverless functions using [Nimbella Cloud](https://nimbella.com/product/platform).

- [Setup](#setup)
- [Inputs](#inputs)
- [Usage](#usage)
  - [Use Nimbella Projects with Netlify Sites](#Use-Nimbella-Projects-with-Netlify-Sites)
  - [Deploy Netlify Functions on Nimbella Cloud](#Deploy-Netlify-Functions-on-Nimbella-Cloud)
- [Examples](#examples)
- [Support](#support)
- [License](#license)

## Setup

> **Note:** Build Plugins are not available on the legacy "Ubuntu Trusty 14.04" build image. Update your Netlify build image to "Ubuntu Xenial 16.04".

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

## Inputs

This section describes the possible inputs that the plugin can accept.

```toml
[nimbella]
functions = "functions" # Functions source directory. Use this if you would like to use Nimbella to deploy your functions.
timeout = 6000 # Function timeout limit in milliseconds.
memory = 256 # Function memory limit in MB.
path = "/.netlify/functions/" # The prefix path to access your deployed packages. Change this if you're using both Netlify Functions and Nimbella for your backend.
```

## Usage

Learn how to structure your repository and `netlify.toml` for this plugin to deploy your functions on Nimbella Cloud.

#### Use Nimbella Projects with Netlify Sites

> Learn about Nimbella projects [here](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment)

All we need is a directory named `packages` at the base of your repository. The plugin will automatically deploy the packages inside `packages` and will also create redirect rules so all requests to `/.netlify/functions/*` will be redirected to functions (actions) deployed on Nimbella.

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

To invoke the function `login`, we would make a request to `https://your-site.com/.netlify/functions/auth/login` (i.e. we need to prefix the package name `auth` to invoke the function `login`.)

If you're using Netlify Functions, you need to change the base prefix `/.netlify/functions/` to something different (e.g. `/api/`) in `netlify.toml` so Netlify Functions can be accessed using `/.netlify/functions/` route and Nimbella Functions can be accessed using `/api/` route.

```toml
[nimbella]
path = '/api/' # default /.netlify/functions/.
```

#### Deploy Netlify Functions on Nimbella Cloud

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

**Note:** When you're using `packages` along with functions, make sure to apend "default" to `.netlify/funcitons` to invoke the functions as all functions are deployed under `default` package of your namespace.

## Examples

These are few sites that use `netlify-plugin-nimbella` to deploy frontend content to Netlify and functions on Nimbella.

- [`netlify-plugin-nimbella.netlify.app`](https://github.com/nimbella/netlify-plugin-nimbella.netlify.app)
- [`netlify-nimbella-faunadb.netlify.app`](https://github.com/nimbella/netlify-faunadb-example)
- [`netlify-nimbella-ocr.netlify.app`](https://github.com/nimbella/netlify-nimbella-ocr)

Look at `netlify.toml` of these repositories to get an idea on how the plugin is used.

## Support

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
