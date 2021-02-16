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
3. **Support for key-value and object stores:** build stateful APIs, and handle images or files with no additional resources to provision.
4. **Easier packaging:** skip the hassles of web packing and working with dependencies.
5. **Cloud portability**: repeatable deployments that work across clouds.

Learn more about the Nimbella add-on for Netlify [on our website](https://nimbella.com/integrations/netlify).

- [Add-On Setup](#add-on-setup)
  - [New to Nimbella](#new-to-nimbella)
  - [Existing Nimbella User](#existing-nimbella-developer)
  - [Minimal Netlify TOML Configuration](#minimal-netlify-toml-configuration)
- [Usage](#usage)
  - [Use Nimbella Projects with Netlify Sites](#use-nimbella-projects-with-netlify-sites)
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

The add-on will create a Nimbella namespace where your resources are allocated. Your Nimbella namespace includes your serverless APIs, a dedicated key-value store, and access to an integrated object store.

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

You may provide additional configuration in the `netlify.toml` file. The plugin input configuration is optional, however you will want to at least set the API `path` to avoid CORS issues between your frontend and backend components of your cloud application.

```toml
[[plugins]]
package = "netlify-plugin-nimbella"

[plugins.inputs]
path    = "/api"   # The prefix path to access your deployed packages.
web     = false    # Deploy frontend and proxy domain to Nimbella (allowed values are true or false).
env     = []       # Environment variables to export to serverless APIs.
```

## Understanding your Nimbella Project

The Nimbella add-on for Netlify allows you to use [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) to automate packaging and deployment. We suggest reading the documentation about [Nimbella projects](https://nimbella.io/downloads/nim/nim.html#overview-of-nimbella-projects-actions-and-deployment) at some point. We provide a quick introduction here.

Nimbella projects inspect a directory named `packages` at the base of your repository. The contents of this directory dictate the serverless APIs that are deployed. The plugin will automatically deploy each API inside the `packages` directory. We use the term `action` to be synonymous with serverless API (or serverless function). Each API can accessed using the following pattern: `https://your-site.com/<path(default="api")>/<packageName>/<actionName>`.

For example, for the following project structure:

```
site
├── netlify.toml
├── packages
│   ├── auth
│   │   ├── login
│   │   │   └── index.js
│   │   └── logout.js
│   └── todos
│       ├── create.py
│       ├── delete.php
│       ├── list.go
│       └── update.swift
└── web
    └── index.html
```

The APIs are `auth/login`, `auth/logout`, `todos/create`, and so on. An API may be a single file, or built from a set of files within an enclosing directory. You may mix languages, and deploy functions as source, without even building languages that require compilation. To API end point for any of the actions is constructed in the same way. For example the serverless API implemented by `auth/login/index.js` is invoked with the REST end point `https://your-site.com/api/auth/login`.

Your Nimbella project may also include a `web` folder which can be deployed to the Nimbella cloud as well. The web folder represents the frontend assets for your projects (e.g., HTML, CSS, JavaScript). In a typical deployment of a Nimbella project using Netlify, you will use the Netlify CDN to serve your web assets. There are however some use-cases where you want to deploy the entire project to Nimbella, and proxy to your Nimbella domain from your Netlify site. To do this, you need to enable the deployment of the web portion of your project by setting an option `web = true` in the `plugins.inputs` section of your `netlify.toml` file.

```toml
[plugins.inputs]
# Deploy the web folder and proxy your site entirely to your Nimbella deployment.
web = true
```

## Cleaning your Nimbella Namespace

The Nimbella project configuration (`project.yml`) allows for cleaning your namespace, or deployed API package. See [the documentation](https://docs.nimbella.com/configuration#adding-project-configuration) for more details on sanitizing the namespace between deployments.

## Exporting Environment Variables to Serverless APIs

If your serverless APIs require environment variables, you have to export the variables explicitly in the `plugins.input` section of the `netlify.toml` file. This is to avoid exporting the entire environment to your APIs, and instead selecting exporting only the variables the actions need access to.

```toml
[plugins.inputs]
# Export specified environment variables to the serverless APIs
env = ['ENV_ONE', 'ENV_TWO']
```

## Example Projects

These are few sites that use `netlify-plugin-nimbella` to deploy frontend content to Netlify and functions on Nimbella.

- [A "hello world" example](https://github.com/nimbella/netlify-plugin-nimbella.netlify.app)
- [Optical character recognition using Nimbella key-value and object stores](https://github.com/nimbella/netlify-nimbella-ocr)

Look at `netlify.toml` of these repositories to get an idea on how the plugin is used.

## Support

We welcome your feedback, and we are  happy to help you with any issues you encounter. You may want to [join our Slack community](https://nimbella-community.slack.com) to engage with us for a more rapid response. Otherwise, open an issue and provide us with details about your situation so we can respond adequately.

## License

Apache-2.0. See [LICENSE](LICENSE) to learn more.
