
const test = require('tape')
const fs = require('fs')
const build = require('./index')

test("Successful build", assert => {
    clean();
    
    build({
        target: './test/package-pass.json',
    })
    .then(code => {
        assert.ok(code === 0, "exits with zero");
        
        assert.ok(fs.existsSync('test/sub1/yes-it-worked.txt'), "sub1 built");
        assert.ok(fs.existsSync('test/sub2/yes-it-worked.txt'), "sub2 built");
        
        assert.end();
    })
})


test("Failed build", assert => {
    clean();
    
    build({
        target: './test/package-fail.json',
    })
    .then(code => {
        assert.ok(code > 0, "exits with non-zero");
        
        assert.ok(fs.existsSync('test/sub1/yes-it-worked.txt'), "sub1 built");
        assert.notOk(fs.existsSync('test/sub2/yes-it-worked.txt'), "sub2 did not build");
        
        assert.end();
    })
})


// TODO test command parameters

function clean() {
    try {
        fs.unlinkSync('test/sub1/yes-it-worked.txt');
        fs.unlinkSync('test/sub2/yes-it-worked.txt');
    }
    catch (err) {}
}
