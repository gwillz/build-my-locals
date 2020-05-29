#!/usr/bin/env node

import path from 'path';
import chalk from 'chalk';
import { spawn, ChildProcess, ChildProcessWithoutNullStreams }from 'child_process';

const VERSION = '2.3.3';

interface Options {
    script: string;
    target: string;
    groups: string[];
    "git-pull"?: boolean;
    install?: boolean;
    ci?: boolean;
    all?: boolean;
    verbose?: boolean;
    "no-color"?: boolean;
    version?: boolean;
    help?: boolean;
}

interface RunError extends Error {
    script: string;
    child: ChildProcess;
    output: string;
}

function isRunError(test: unknown): test is RunError {
    return test instanceof Error && test.name === "RunError";
}

type Args = Record<string, string | string[] | true>;

/**
 * This scans through 'package.json' to find dependency packages that are
 * locally sourced. It then executes the prepare scripts, as defined in
 * their respective 'package.json' files.
 */
export default async function main(opts?: Partial<Options>) {
    const options: Options = {
        script: 'build',
        target: './package.json',
        groups: [
            'dependencies',
            'devDependencies',
        ],
        ...opts,
    };

    if (options.help) {
        help();
        return;
    }

    if (options.version) {
        version();
        return;
    }

    if (options['no-color']) {
        chalk.level = 0;
    }

    if (options.all) {
        options.install = false;
        options.ci = true;
        options['git-pull'] = true;
    }
    else if (options.install || options.ci || options['git-pull']) {
        options.script = "";
    }

    const processes: ChildProcess[] = [];
    const promises: Promise<string>[]= [];

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
        if (options.script && !(local.scripts && local.scripts[options.script])) {
            console.log(chalk.red(`:: Local '${name}' does not have a '${options.script}' script`));
            continue;
        }

        // build
        promises.push((async function() {
            let output = "";

            if (options["git-pull"]) {
                const child = spawn('git', ['pull'], { cwd });
                processes.push(child);

                console.log(chalk`:: {yellow Pulling}    '${name}'`);
                output += chalk`>> {green Pull Output}    '${name}'\n`;
                output += await handleChild(name, child, !!options.all);
                output += "\n";
            }

            if (options.install || options.ci) {
                const script = options.ci ? 'ci' : 'install';
                const child = spawn('npm', [script], { cwd });
                processes.push(child);

                console.log(chalk`:: {yellow Installing} '${name}'`);
                output += chalk`>> {green Install Output} '${name}'\n`;
                output += await handleChild(name, child);
                output += "\n";
            }

            if (options.script) {
                const child = spawn('npm', ['run', options.script], { cwd });
                processes.push(child);

                console.log(chalk`:: {yellow Building}   '${name}'`);
                output += chalk`>> {green Build Output}   '${name}'\n`;
                output += await handleChild(name, child);
            }

            console.log(chalk`>> {green Completed}  '${name}'`);
            return output;
        })());
    }

    // execute all at once
    try {
        const outputs = await Promise.all(promises);

        if (options.verbose) {
            for (let output of outputs) {
                console.log(output);
            }
        }
    }
    catch (error) {
        // Kill everything even if just one child is out of line.
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
function handleChild(name: string, child: ChildProcessWithoutNullStreams, allowFail = false) {

    // connect output events
    let output = '';
    child.stdout.on('data', data => output += data.toString("utf-8"));
    child.stderr.on('data', data => output += data.toString("utf-8"));

    // tie up results in a promise
    return new Promise<string>((resolve, reject) => {

        child.on('error', err => {
            console.log(chalk`>> {red Fatal error!}`);
            console.log(err);
            exit();
        });

        child.on('close', err => {
            if (err && err > 0) {
                console.log(chalk`>> {red Failed on '${name}'}`);
                exit();
            }
        });

        // don't fret little one, this script only exits after you're done.
        child.on('exit', err => {
            if (err && err > 0) {
                console.log(chalk`>> {red Failed on '${name}'}`);

                // exit, kills other child processes (I lied.)
                exit();
            }
            else {
                // good
                resolve(output);
            }
        })

        function exit() {
            if (!allowFail) {
                reject(createError(name, child, output));
            }
            else {
                console.log(chalk`>> {red Warning: ${name}!}`);
                console.log(chalk`>> {red ${output}}`);
            }
        }
    })
}

/**
 *
 * @param script
 * @param child
 */
function createError(script: string, child: ChildProcess, output: string): Error {
    const error = new Error(`Fatal error in ${script}`) as RunError;
    error.script = script;
    error.child = child;
    error.output = output;
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


function help() {
    console.log('build-my-locals');
    console.log('');
    console.log('Options:');
    console.log('  --script : the desired script (default: build)');
    console.log('  --target : where to find the module names (default: ./package.json)');
    console.log('  --groups : what groups to build (default: dependencies,devDependencies)');
    console.log('');
    console.log('Tasks:');
    console.log('  --git-pull : perform a pull first');
    console.log('  --install  : before build, after pull');
    console.log('  --ci       : before build, after pull');
    console.log('  --all      : run pull-ci-build in order');
    console.log('');
    console.log('Options:');
    console.log('  --verbose  : print too much');
    console.log('  --no-color : disabled colours');
    console.log('');
    console.log(`  --version : ${VERSION}`);
    console.log('  --help    : this');
}


function version() {
    console.log('build-my-locals');
    console.log('Version: ' + VERSION);
    console.log('');
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
            if (isRunError(error)) {
                console.log(error.output);
            }
            process.exitCode = 1;
        }
        console.log("");
    })();
}
