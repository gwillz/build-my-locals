////////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2018 Good Thnx Pty Ltd
////////////////////////////////////////////////////////////////////////////////

const path = require('path')
const chalk = require('chalk')
const {spawn} = require('child_process')

const TARGET = 'prepare';

/**
 * This scans through 'package.json' to find dependency packages that are
 * locally sourced. It then executes the prepare scripts, as defined in
 * their respective 'package.json' files.
 *
 * This reads no runtime arguments or environment variables.
 */
function main() {
    const root = require('../package.json');
    const processes = [];
    let killed = false;
    
    for (let name in root.dependencies) {
        // filter for non-repository packages
        let match = root.dependencies[name].match(/([^:]+):(.+)/);
        if (!match) continue;
        
        // filter local file packages
        let [_, proto, cwd] = match;
        if (proto !== 'file') continue;
        
        // warning if missing target ('prepare') script
        let local = require(path.resolve(cwd, 'package.json'));
        if (!local.scripts || !local.scripts[TARGET]) {
            console.log(chalk.red(`:: Local '${name}' does not have a '${TARGET}' script`))
            continue;
        }
        
        // build
        console.log('::', `Building '${name}'...`);
        const child = spawn('npm', ['run', TARGET], { cwd });
        processes.push(child);
        
        // connect output events
        let output = '';
        child.stdout.on('data', data => output += data);
        child.stderr.on('data', data => output += data);
        
        child.on('error', err => {
            console.log('>>', chalk.red('Fatal error!'))
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
        })
    }
    
    // scoped method for killing child processes before an exit(1)
    function quit(callee) {
        killed = true;
        for (let child of processes) {
            if (child === callee) continue;
            child.kill();
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
