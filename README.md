# netlify-plugin-nimbella

A Netlify Build Plugin that extends Netlify Functions to support different runtimes.

## Installation

Just add this to your netlify.toml:

```toml
[[plugins]]
package = "netlify-plugin-nimbella"
```

Create an environmental variable named `NIM_TOKEN` using any of the channels mentioned in this [guide](https://docs.netlify.com/configure-builds/environment-variables/#declare-variables).

## Usage

Add a `functions` property as below to your `netlify.toml`. Make sure to remove `functions` property under `[build]` in your `netlify.toml`.

```toml
[nimbella]
functions = "./functions" # Path to lambda functions directory
```

You can create a `packages` directory at the root of your repository and `netlify-plugin-nimbella` will automatically deploy them during the build.

Here's an example repo that uses `netlify-plugin-nimbella` plugin.
