# main-dir

This package is a userland implementation of a proposed change to the Node module resolution alogrithm, proposed in [nodejs/node#14970](https://github.com/nodejs/node/issues/14970).

This adds support for a `mainDir` property in package.json files, which lets package authors indicate a subfolder of the package that all lookups should be relative to.

## Usage

```js
require('main-dir');
// All require calls from here on out will respect `mainDir` 
// options when present in package.json files
```

## Use cases

The predominant use case for this is for packages written in a different source language, and compiled/transpiled down to JavaScript to ensure interopability with the widest audience of Node.js consumers.

Without `mainDir`, such package authors are left with a tradeoff when it comes time to compile and publish their work:

1. They compile into a `dist/` folder and publish the root directory. Downside: consumers must include `dist/` in the path of any file-specific imports, i.e. `require('foo/dist/bar/quux')`.
2. They compile into a `dist/` folder and publish _only_ the `dist/` folder. Downside: they must remember to publish from a subfolder every time, and if the author wants to ship other files in the package (i.e. a readme), additional build steps are now required to copy those into `dist/` too.
3. They compile into the project root and publish the root directory. Downside: cluttered root directory, especially while using npm link to test the package locally, as well as potential naming collisions with other package files.

With the proposed changes, such addon authors could specify `"mainDir": "dist"` in their package.json, and avoid any of these downsides:

1. Consumers don't need to specify build directories in import paths, since Node would check `mainDir` automatically and transparently
2. The author can publish from root directory like a normal package, no additional build steps needed to include readmes, etc.
3. Projects stay tidy by compiling into a single `dist/` folder

If a `main` field is also specified, and the consumer attempts to import the entire module, then `mainDir` and `main` are joined to find the entry point for the module:

```
// foo/package.json
{
  "main": "helloworld.js",
  "mainDir": "dist"
}

// my-app.js
require('foo'); // loads 'foo/dist/helloworld.js'
```

If no `main` field is specified, then the usual `index.js` file is attempted:

```
// foo/package.json
{
  "mainDir": "dist"
}

// my-app.js
require('foo'); // loads 'foo/dist/index.js'
```

## Potential downsides

The module resolution alogrithm is sacrosanct in Node, largely because even subtle changes have the chance to potentially break the vast ecosystem of packages relying on the current semantics.

The proposal above for a change to core attempts to minimize this by claiming a new package.json field rather than repurposing the existing `main` field. A Github code search reveals zero uses of the newly proposed `mainDir` field in any public package.json file. While this doesn't guarantee that private repositories somehwere are not using it, it's a strong indicator that any such use is minimal (if existent at all).

## Where does this package fit in?

This package, `main-dir`, provides an opt-in way to try the proposed semantics. It does so by monkey-patching Node's Module class. Only a handful of lines are changed to check for and respect any `mainDir` fields encountered. Require this package once in your Node process, and all subsequent requires will respect `mainDir`.

Because it monkey-patches the Module class, care should be taken when upgrading Node. While the semantics of that Module are unlikely to change from version to version, caution is still worthwhile given the low-level nature of the patching performed by this package.