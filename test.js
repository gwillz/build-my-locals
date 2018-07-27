
const test = require('tape')
const fs = require('fs')
const {spawnSync} = require('child_process')
const build = require('./index')

test("getArgs()", assert => {
    {
        const actual = build.getArgs(['node', 'script.js']);
        const expected = {};
        
        assert.deepEqual(actual, expected);
    }
    {
        const actual = build.getArgs(['node', 'script.js', '--script', 'foo']);
        const expected = {script: 'foo'};
        
        assert.deepEqual(actual, expected);
    }
    {
        const actual = build.getArgs(['node', 'script.js', '--script', '--foo']);
        const expected = {script: true, foo: true};
        
        assert.deepEqual(actual, expected);
    }
    {
        const actual = build.getArgs(['node', 'script.js', '--script', 'foo', '--bar']);
        const expected = {script: 'foo', bar: true};
        
        assert.deepEqual(actual, expected);
    }
    {
        const actual = build.getArgs(['node', 'script.js', '--script', 'foo', '--bar', 'foobar']);
        const expected = {script: 'foo', bar: 'foobar'};
        
        assert.deepEqual(actual, expected);
    }
    assert.end();
})

test("Successful build", assert => {
    clean();
    
    build({
        target: './test/package-pass.json',
    })
    .then(() => {
        assert.ok(fs.existsSync('test/sub1/yes-it-worked.txt'), "sub1 built");
        assert.ok(fs.existsSync('test/sub2/yes-it-worked.txt'), "sub2 built");
        
        assert.end();
    })
    .catch(err => {
        assert.comment(err);
        assert.fail("should not throw");
    })
})

test("Failed build", assert => {
    clean();
    
    build({
        target: './test/package-fail.json',
    })
    .then(() => {
        assert.fail("should not resolve");
    })
    .catch(err => {
        assert.ok(fs.existsSync('test/sub1/yes-it-worked.txt'), "sub1 built");
        assert.notOk(fs.existsSync('test/sub2/yes-it-worked.txt'), "sub2 did not build");
        
        assert.end();
    })
})

test("Test exit code", assert => {
    clean();

    const actual = spawnSync('node', [
        'index.js',
        '--script', 'prepare',
        '--target', 'test/package-fail.json',
    ])
    const expected = 1;
    
    assert.equal(actual.status, expected, "exits with non-zero");
    assert.end();
})


function clean() {
    try {
        fs.unlinkSync('test/sub1/yes-it-worked.txt');
        fs.unlinkSync('test/sub2/yes-it-worked.txt');
    }
    catch (err) {}
}
