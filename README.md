# netlify-plugin-nimbella

[![Version](https://img.shields.io/npm/v/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![Downloads/week](https://img.shields.io/npm/dw/netlify-plugin-nimbella.svg)](https://npmjs.org/package/netlify-plugin-nimbella)
[![License](https://img.shields.io/npm/l/netlify-plugin-nimbella.svg)](https://github.com/nimbella/netlify-plugin-nimbella/blob/master/package.json)

A Netlify Build Plugin that extends Netlify Functions to support different runtimes using [Nimbella Cloud](https://nimbella.com/product/platform).

- [Setup](#setup)
- [Usage](#usage)
  - [Deploy Existing Netlify Functions to Nimbella Cloud](#Deploy-Existing-Netlify-Functions-to-Nimbella)

## Setup

Use Netlify addon `nimbella` to connect your Netlify site to Nimbella.

1. Add the Nimbella Add-on for Netlify

   Run the below at the base of your local project directory linked to your Netlify site.

   ```sh
   $ netlify addons:create nimbella
   ```

2. Add Nimbella Build Plugin to Your Netlify Site

   Append the below to your `netlify.toml`.

   ```toml
   [[plugins]]
   package = "netlify-plugin-nimbella"
   ```

## Usage

This Build Plugin brings Nimbella Cloud to Netlify sites.

### Deploy Existing Netlify Functions to Nimbella Cloud

Remove functions property from [build] and add it under [nimbella].

```diff
# Settings in the [build] context are global and are applied to all contexts
# unless otherwise overridden by more specific contexts.
[build]
-  # Directory with the serverless Lambda functions to deploy to AWS.
-  functions = "functions/"
+ [nimbella]
+  functions = "functions/"
```
