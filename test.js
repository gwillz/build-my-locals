
const test = require('tape')
const fs = require('fs')
const build = require('./index')

test("Example project", assert => {
    clean();
    
    build({
        package: './test/package.json',
    })
    .then(code => {
        if (code > 0) assert.fail();
        
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
