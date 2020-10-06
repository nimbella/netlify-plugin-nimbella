# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Join Slack](https://img.shields.io/badge/join-slack-9B69A0.svg)](https://nimbella-community.slack.com/)
[![Twitter](https://img.shields.io/twitter/follow/nimbella.svg?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=nimbella)

The Nimbella add-on for Netlify is a Netlify Build Plugin that extends Netlify Sites with portable and stateful serverless functions using [Nimbella](https://nimbella.com/product/platform). The add-on enables developers to deploy sites to Netlify's CDN, and serverless functions and stateful APIs to the [Nimbella Cloud](https://nimbella.com).

The Nimbella add-on provides the following benefits.
1. **More runtimes:** implement functions in numerous languages including Python, Rust, Swift, Ruby, PHP, Java, Go, Node, and Deno.
2. **Resource customization:** run functions for longer durations, and with more memory.
3. **Support for key-value and object stores:** build stateful APIs, and handle images or files.
4. **Easier packaging:** skip the hassles of web packing and working with dependencies.
5. **Cloud portability**: repeatable deployments that work across clouds.

Learn more about the Nimbella add-on for Netlify [on our website](https://nimbella.com/integrations/netlify).

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

The add-on will create a Nimbella namespace where your resources are allocated. Your Nimbella namespace includes your serverless functions, a dedicated key-value store, and access to an integrated object store.

<!--TODO: add steps to claim the namespace and configure `nim` CLI when the flow is enabled. -->
<!--You may claim the namespace and login to your Nimbella account by running `netlify addons:auth nimbella`.-->

### Existing Nimbella Developer

You can use the Nimbella add-on for Netlify with your existing Nimbella account. This is accomplished by creating a Netlify Build environment variable so the plugin can deploy the resources to the Nimbella namespace of your choosing.

1. You will need to you the [Nimbella CLI `nim`](https://nimbella.io/downloads/nim/nim.html) or the [Nimbella Workbench](https://nimbella.io/wb) to export a login token to run the command shown below. If you want to sign up for a free Nimbella account or to login, visit [`nimbella.com/login`](https://nimbella.com/login) to get started.

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
[[plugins]]
package = "netlify-plugin-nimbella"
[plugins.inputs]
functions = "functions" # Functions source directory. Use this if you would like to use Nimbella to deploy your functions.
memory = 256 # Function memory limit in MB.
path = "/api/" # The prefix path to access your deployed packages.
timeout = 6000 # Function timeout limit in milliseconds.
```

## Usage

In this section, you will learn how to structure your repository and `netlify.toml` for this plugin to deploy your functions on Nimbella Cloud.

**Note:** Deployment of packages/functions to Nimbella is skipped when the build context is not "production". We're working on an enhancement that will allow you to deploy preview builds to staging namespaces on Nimbella.

#### Use Nimbella Projects with Netlify Sites

The Nimbella add-on for Netlify allows you to use [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) to automate packaging and deployment. We suggest reading the documentation about [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) at some point. We provide a quick introduction here.

Nimbella projects inspect a directory named `packages` at the base of your repository. The contents of this directory dictate the serverless functions that are deployed. The plugin will automatically deploy the functions inside `packages` and all of the functions (also called actions) can accessed using the following pattern: `https://your-site.com/<path(default="api")>/<packageName>/<actionName>`.

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

You will invoke the function `auth/login.js` via the API end point `https://your-site.com/api/auth/login`.

#### Deploy Netlify Functions on Nimbella Cloud

You can deploy your existing Netlify Functions to Nimbella Cloud with very minimal changes.

Specify the `functions` input value under `[plugins.inputs]` inside `netlify.toml`.

```diff
[[plugins]]
package = "netlify-plugin-nimbella"
+ [plugins.inputs]
+ functions = "functions" # Functions source directory. Use this if you would like to use Nimbella to deploy your functions.
```

This plugin builds your functions using a modified version of [netlify-lambda](https://github.com/netlify/netlify-lambda). You can get rid of any build steps you're performing on functions since the plugin handles it for you.

**Notes:**
- None of environment variables present in the Netlify build runtime are made available to the deployed functions on Nimbella Cloud. _An enhancement to permit selective forwarding of environment variables is coming soon._
- Replace occurrences of `/.netlify/functions` in your API calls with `/.netlify/nimbella`, or use `/api`, as your API path instead.
- All Netlify functions are deployed to a "default" package in your Nimbella namespace. The package name is required in the API path. For Netlify functions, the path will be `/.netlify/nimbella/default/` or `/api/default`. For named packages, replace `default` with your package name instead.

## Examples

These are few sites that use `netlify-plugin-nimbella` to deploy frontend content to Netlify and functions on Nimbella.

- [A "hello world" example](https://github.com/nimbella/netlify-plugin-nimbella.netlify.app)
- [Optical character recognition using Nimbella key-value and object stores](https://github.com/nimbella/netlify-nimbella-ocr)

Look at `netlify.toml` of these repositories to get an idea on how the plugin is used.

## Support

We're always happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response. Otherwise, open an issue and provide us with details about your situation so we can respond adequately.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
