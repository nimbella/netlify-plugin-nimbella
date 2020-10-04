# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Join Slack](https://img.shields.io/badge/join-slack-9B69A0.svg)](https://nimbella-community.slack.com/)
[![Twitter](https://img.shields.io/twitter/follow/nimbella.svg?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=nimbella)

A Netlify Build Plugin that extends Netlify Sites with support for portable and stateful serverless functions using [Nimbella](https://nimbella.com/product/platform). The add-on enables Netlify developers to deploy serverless functions and stateful APIs to the Nimbella cloud 1) with more programming language choices, 2) easier packaging, 3) customizable runtimes and durations, and 4) cloud portability. 

Learn more about Nimbella's integration for Netlify from [here](https://nimbella.com/integrations/netlify).

- [Add-On Setup](#add-on-setup)
  - [New to Nimbella](#new-to-nimbella)
  - [Existing Nimbella User](#existing-nimbella-developer)
  - [Minimal Netlify TOML Configuration](#minimal-netlify-toml-configuration)
- [Usage](#usage)
  - [Use Nimbella Projects with Netlify Sites](#use-nimbella-projects-with-netlify-sites)
  - [Deploy Netlify Functions on Nimbella Cloud](#deploy-netlify-functions-on-nimbella-cloud)
- [Examples](#examples)
- [Support](#support)
- [License](#license)

## Add-On Setup

> **Note:** Netlify Build Plugins are not available on the legacy "Ubuntu Trusty 14.04" build image. Update your Netlify build image to "Ubuntu Xenial 16.04".

### New to Nimbella

Add the Nimbella add-on for Netlify to connect your Netlify site to Nimbella.
To do that, run the following command from the base of your local project directory which is linked to your Netlify site.
```sh
netlify addons:create nimbella
```

The addon will create a Nimbella namespace where your resources are allocated. Your Nimbella namespace includes your serverless functions, a dedicated key-value store, and access to an integrated object store.

You may claim the namespace and login to your Nimbella account by running `netlify addons:auth nimbella`.

### Existing Nimbella Developer

You can use the Nimbella add-on for Netlify with your existing Nimbella account. This is accomplished by creating a Netlify Build environment variable so the plugin can deploy the resources to the Nimbella namespace of your choosing.

1. You will need to you the [Nimbella CLI `nim`](https://nimbella.io/downloads/nim/nim.html) or the [Nimbella Workbench](https://nimbella.io/wb) to export a login token to run the command shown below. If you want to sign up for a free Nimbella account or to login, visit [`nimbella.com/login`](https://nimbella.com/login)) to get started.

```sh
nim auth export --non-expiring
```

2. Next, run the following command `netlify env:set NIMBELLA_LOGIN_TOKEN <token>` to create an environment variable named `NIMBELLA_LOGIN_TOKEN` and provide the token you just obtained as its value.

### Minimal Netlify TOML Configuration

Once your add-on is configured, you need to add the Nimbella Build Plugin to Your Netlify Site. This is done by appending the section below to your `netlify.toml` file.

```toml
[[plugins]]
package = "netlify-plugin-nimbella"
```

You may provide additional configuration in the `netlify.toml` file to configure the resources available to your serverless functions, or to configure the API path for your functions. Here is an example.

```toml
[nimbella]
functions = "functions" # Functions source directory. Use this if you would like to use Nimbella to deploy your functions.
timeout = 6000 # Function timeout limit in milliseconds.
memory = 256 # Function memory limit in MB.
path = "/.netlify/functions/" # The prefix path to access your deployed packages. Change this if you're using both Netlify Functions and Nimbella for your backend.
```

## Usage

In this section, you will learn how to structure your repository and `netlify.toml` for this plugin to deploy your functions on Nimbella Cloud.

#### Use Nimbella Projects with Netlify Sites

The Nimbella add-on for Netlify allows you to use [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) to automate packaging and deployment. We suggest reading the documentation about [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) at some point. We provide a quick introduction here.

Nimbella projects inspect a directory named `packages` at the base of your repository. The contents of this directory dictate the serverless functions that are deployed. The plugin will automatically deploy the functions inside `packages` and will also create redirect rules so all requests to `/.netlify/functions/*` are redirected to functions (also called actions) deployed on Nimbella.

For example, for the following project structure:

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

You will invoke the function `auth/login.js` via the API end point `https://your-site.com/.netlify/functions/auth/login`.

If you're using Netlify Functions, you need to change the base prefix `/.netlify/functions/` to something different (e.g. `/api/`) in `netlify.toml` so Netlify Functions can be accessed using `/.netlify/functions/` and Nimbella Functions can be accessed using `/api/` route.

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

**Note:** When you're using `packages` along with functions, make sure to apend "default" to `.netlify/functions` to invoke the functions as all functions are deployed under `default` package of your namespace.

## Examples

These are few sites that use `netlify-plugin-nimbella` to deploy frontend content to Netlify and functions on Nimbella.

- [A "hello world" example](https://github.com/nimbella/netlify-plugin-nimbella.netlify.app)
- [Combining Netlify with Nimbella and Fauna](https://github.com/nimbella/netlify-faunadb-example)
- [Optical character recognition using Nimbella key-value and object stores](https://github.com/nimbella/netlify-nimbella-ocr)

Look at `netlify.toml` of these repositories to get an idea on how the plugin is used.

## Support

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response. Otherwise, open an issue and provide us with details about your situation so we can respond adequately.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
