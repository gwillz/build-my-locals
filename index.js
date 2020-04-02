////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2018 Good Thnx Pty Ltd
////////////////////////////////////////////////////////////////////////////////

const path = require('path')
const chalk = require('chalk')
const {spawn} = require('child_process')


/**
 * This scans through 'package.json' to find dependency packages that are
 * locally sourced. It then executes the prepare scripts, as defined in
 * their respective 'package.json' files.
 *
 * This reads no runtime arguments or environment variables.
 */
function main(options) {
    options = {
        script: 'prepare',
        target: './package.json',
        groups: [
            'dependencies',
            'devDependencies',
        ],
        ...options,
    }

    const processes = [];
    const promises = [];

    // we're building the dependencies of this package
    const root = require(options.target);

    // combine dependency group into a single map
    // this is important to avoid duplicates
    const allDependencies = new Map();
    for (let group of options.groups) {
        for (let name in root[group]) {
            allDependencies.set(name, root[group][name]);
        }
    }

    for (let [name, dependency] of allDependencies) {
        // filter for non-repository packages
        const match = dependency.match(/([^:]+):(.+)/);
        if (!match) continue;

        // filter 'file' type packages, aka. locals
        const [_, proto, directory] = match;
        if (proto !== 'file') continue;

        // local scripts are relative to the target package
        const cwd = path.resolve(path.dirname(options.target), directory);

        // this is a dependency package of the 'root' package
        const local = require(path.resolve(cwd, 'package.json'));

        // warning if missing target script
        if (!local.scripts || !local.scripts[options.script]) {
            console.log(chalk.red(`:: Local '${name}' does not have a '${options.script}' script`));
            continue;
        }

        // build
        console.log('::', `Building '${name}'...`);
        const {promise, child} = run(name, options.script, cwd);
        promises.push(promise);
        processes.push(child);
    }

    // execute all at once
    return Promise.all(promises)
    .catch(({name, callee}) => {
        for (let child of processes) {
            if (child === callee) continue;
            child.kill();
        }
        throw new Error(`Fatal error in '${name}'`);
    })
}

function run(name, script, cwd) {
    const child = spawn('npm', ['run', '-s', script], { cwd });

    // connect output events
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);

    // tie up results in a promise
    const promise = new Promise((resolve, reject) => {
        child.on('error', err => {
            console.log('>>', chalk.red('Fatal error!'));
            console.log(err);
            reject({name, child});
        })

        // don't fret little one, this script only exits after you're done.
        child.on('exit', err => {
            if (err > 0) {
                console.log('>>', chalk.red(`Failed on '${name}'`));
                console.log(output);

                // exit, kills other child processes (I lied.)
                reject({name, child});
                return;
            }
            // good
            console.log('>>', chalk.green('Completed'), `'${name}'`);
            resolve();
        })
    })

    return {child, promise};
}

function getArgs(argv = process.argv) {
    let args = {};
    let name = null;

    for (let arg of argv.slice(2)) {
        // current is a param
        if (arg.startsWith('--')) {
            // previous was also param, therefore is a boolean
            if (name) {
                args[name] = true;
            }
            name = arg.slice(2);
            continue;
        }
        // last was a param
        if (name) {
            // arrays
            if (arg.includes(',')) {
                arg = arg.split(',');
            }
            args[name] = arg;
            name = null;
        }
    }
    // last was a param, therefore a boolean
    if (name) {
        args[name] = true;
    }
    return args;
}

/* istanbul ignore next */
if (require.main === module) {
    main(getArgs())
    .catch(err => {
        process.exitCode = 1;
    });
}

module.exports = main;
module.exports.getArgs = getArgs;
