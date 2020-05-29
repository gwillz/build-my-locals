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
        "postinstall": "build-my-locals"
    },
    "dependencies": {
        "bar": "./libs/bar-package"
    },
    "devDependencies": {
        "build-my-locals": "^2.3.2",
        "foobar": "../other/path/to/another/package"
    }
}
```

Run `npm run postinstall`. This will build `bar` and `foobar` via their `build` script.
This also executes after calling `npm ci` or `npm install`.

### Options

- `--target <path>` - specify a particular `package.json` file
- `--script <name>` - script name to run
- `--groups <list,list>` - which groups to read for dependencies
    - dependencies
    - devDependencies
    - or both!
- `--install or --ci` - run install/ci, ignore scripts
- `--git-pull` - pull the latest git
- `--all` - do `git-pull, ci, script` in that order
- `--no-color` - disable colour output
- `--verbose` - print stdout/stderr from scripts
- `--version` - print version and exit
- `--help` - print help and exit


## TODO

- recursively build local dependencies
- maintain an 'already-build' list
