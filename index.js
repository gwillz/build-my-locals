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
        package: './package.json',
        groups: [
            'dependencies',
            'devDependencies',
        ],
        ...options,
    }
    const processes = [];
    const promises = [];
    let killed = false;
    
    // we're building the dependencies of this package
    const root = require(options.package);
    
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
        const cwd = path.resolve(path.dirname(options.package), directory);
        
        // this is a dependency package of the 'root' package
        const local = require(path.resolve(cwd, 'package.json'));
        
        // warning if missing target script
        if (!local.scripts || !local.scripts[options.script]) {
            console.log(chalk.red(`:: Local '${name}' does not have a '${options.script}' script`));
            continue;
        }
        
        // build
        console.log('::', `Building '${name}'...`);
        promises.push(run(name, options.script, cwd));
    }
    
    return Promise.all(promises);
    
    // this function will access local vars: [processes, killed]
    function run(name, script, cwd) {
        return new Promise((resolve, reject) => {
            const child = spawn('npm', ['run', script], { cwd });
            processes.push(child);
            
            // connect output events
            let output = '';
            child.stdout.on('data', data => output += data);
            child.stderr.on('data', data => output += data);
            
            child.on('error', err => {
                console.log('>>', chalk.red('Fatal error!'));
                console.log(err);
                quit(child);
            })
            
            // don't fret little one, this script only exits after you're done.
            child.on('exit', err => {
                if (err > 0 && !killed) {
                    console.log('>>', chalk.red('Failed!'));
                    console.log(output);
                    
                    // hard exit, kills other child processes (I lied.)
                    quit(child);
                }
                // good
                console.log('>>', chalk.green('Completed'), `'${name}'`);
                resolve();
            })
            
            // at this point, this is straight up abuse of closures
            function quit(callee) {
                killed = true;
                for (let child of processes) {
                    if (child === callee) continue;
                    child.kill();
                }
                reject();
            }
        })
    }
}

if (require.main === module) {
    let script = process.argv[2];
    let package = process.argv[3];
    main({script, package})
    .catch(() => process.exit(1));
}

module.exports = main;
