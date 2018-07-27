
const test = require('tape')
const fs = require('fs')
const build = require('./index')

test("Example project", assert => {
    clean();
    
    build({
        target: './test/package.json',
    })
    .then(code => {
        assert.ok(code === 0, "exits with zero");
        
        assert.ok(fs.existsSync('test/sub1/yes-it-worked.txt'));
        assert.ok(fs.existsSync('test/sub2/yes-it-worked.txt'));
        
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
