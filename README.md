# Build My Locals!

Sometimes, particularly in a mono-repo, you have projects spread about that
are referenced directly by their local path. Those projects may have a build
script and need to precompiled before being included in the bigger scope.

So this script will build any local dependencies (or devDependencies) in
your `package.json` file.


## Usage

Given a `package.json`:
```json
{
    "name": "...",
    "scripts": {
        "libs": "build-my-locals"
    },
    "dependencies": {
        "foo": "^1.2.3",
        "remote": "git+https://github.com/etc/etc.git",
        "bar": "libs/bar-package"
    },
    "devDependencies": {
        "foobar": "../other/path/to/another/package"
    }
}
```

Run `npm run libs` or `npx build-my-locals` in the same directory as `package.json`.
This will build `bar` and `foobar` via their `prepare` script, but not `foo` or `remote`.

### Options

- `--target <path>` - specify a particular `package.json` file
- `--script <name>` - script name to run
- `--groups <list,list>` - which groups to read for dependencies


## TODO
- recursively build local dependencies
  - but maintain a 'already-build' list
