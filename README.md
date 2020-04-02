# Build My Locals!

Sometimes, particularly in a mono-repo, one will have projects spread about that
are referenced directly by their local path. Some of those projects may have a
build script and need to compiled before being included in the bigger scope.

So this script will build any local dependencies (or devDependencies) in
your `package.json` file.


## Usage

```sh
# Install this package globally for easy access.
npm i -g build-my-locals

# Or include it as a devDependency.
npm i -D build-my-locals
```

Given a `package.json`:
```json
{
    "name": "...",
    "scripts": {
        "libs": "build-my-locals"
    },
    "dependencies": {
        "bar": "./libs/bar-package"
    },
    "devDependencies": {
        "foobar": "../other/path/to/another/package"
    }
}
```

Run `npm run libs` or `npx build-my-locals` in the same directory as `package.json`.
This will build `bar` and `foobar` via their `prepare` script.

### Options

- `--target <path>` - specify a particular `package.json` file
- `--script <name>` - script name to run
- `--groups <list,list>` - which groups to read for dependencies


## TODO

- recursively build local dependencies
- maintain an 'already-build' list
- a '--verbose' option
