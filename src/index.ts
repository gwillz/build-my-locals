#!/usr/bin/env node

import path from 'path';
import chalk from 'chalk';
import { spawn, ChildProcess }from 'child_process';

const ROOT_SCRIPTS = ["install", "ci"];

interface Options {
    script: string;
    target: string;
    groups: string[];
}

interface RunError extends Error {
    script: string;
    child: ChildProcess;
}

type Args = Record<string, string | string[] | true>;

/**
 * This scans through 'package.json' to find dependency packages that are
 * locally sourced. It then executes the prepare scripts, as defined in
 * their respective 'package.json' files.
 */
export default async function main(opts?: Partial<Options>) {
    const options: Options = {
        script: 'prepare',
        target: './package.json',
        groups: [
            'dependencies',
            'devDependencies',
        ],
        ...opts,
    };

    const processes: ChildProcess[] = [];
    const promises: Promise<void>[]= [];

    // we're building the dependencies of this package
    const root = require(path.resolve(options.target));

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
        if (!local.scripts || !local.scripts[options.script] && !ROOT_SCRIPTS.includes(options.script)) {
            console.log(chalk.red(`:: Local '${name}' does not have a '${options.script}' script`));
            continue;
        }

        // build
        console.log('::', `Building '${name}'...`);
        const { promise, child } = run(name, options.script, cwd);

        promises.push(promise);
        processes.push(child);
    }

    // execute all at once
    try {
        await Promise.all(promises);
    }
    catch (error) {
        for (let child of processes) {
            if (child === error.callee) continue;
            child.kill();
        }
        // re-throw
        throw error;
    }
}

/**
 * Execute a single script.
 */
function run(name: string, script: string, cwd: string) {

    const child = ROOT_SCRIPTS.includes(script)
        ? spawn('npm', [script], { cwd })
        : spawn('npm', ['run', '-s', script], { cwd });

    // connect output events
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);

    // tie up results in a promise
    const promise = new Promise<void>((resolve, reject) => {
        child.on('error', err => {
            console.log('>>', chalk.red('Fatal error!'));
            console.log(err);
            reject(createError(name, child));
        })

        // don't fret little one, this script only exits after you're done.
        child.on('exit', err => {
            if (err && err > 0) {
                console.log('>>', chalk.red(`Failed on '${name}'`));
                console.log(output);

                // exit, kills other child processes (I lied.)
                reject(createError(name, child));
                return;
            }
            // good
            console.log('>>', chalk.green('Completed'), `'${name}'`);
            resolve();
        })
    })

    return {child, promise};
}

/**
 *
 * @param script
 * @param child
 */
function createError(script: string, child: ChildProcess): Error {
    const error = new Error(`Fatal error in ${script}`) as RunError;
    error.script = script;
    error.child = child;
    return error;
}

/**
 *
 * @param argv
 */
export function getArgs(argv = process.argv): Args {
    let args: Args = {};
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
            args[name] = arg.includes(',')
                ? arg.split(',')
                : arg;

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
    require('source-map-support').install();

    (async function() {
        try {
            await main(getArgs());
        }
        catch (error) {
            console.log(error);
            process.exitCode = 1;
        }
        console.log("");
    })();
}
