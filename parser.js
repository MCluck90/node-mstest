var spawn = require('child_process').spawn,
    EventEmitter = require('events').EventEmitter;

/**
 * Determines if this line marks the beginning of results
 * @param {string} line
 * @returns {boolean}
 */
function isBeginMarker(line) {
    return line.indexOf('----') === 0;
}

/**
 * Determines if this line marks the end of results
 * @param {string} line
 * @returns {boolean}
 */
function isEndMarker(line) {
    return /\d/.test(line[0]);
}

/**
 * Determines if this line marks the beginning of a new test result
 * @param {string} line
 * @returns {boolean}
 */
function isNewTest(line) {
    var possibleResults = ['Passed', 'Failed', 'Inconclusive'];
    for (var i = 0, len = possibleResults.length; i < len; i++) {
        if (line.indexOf(possibleResults[i]) === 0) {
            return true;
        }
    }
    return false;
}

/**
 * Determines if the line marks the beginning of an attribute
 * @param {string} line
 * @returns {boolean}
 */
function isAttribute(line) {
    return line.indexOf('[') === 0;
}

/**
 * Runs and parses MSTest results on the command-line
 * @param {string}      exePath         Path to mstest.exe
 * @param {string[]}    args            Additional arguments
 * @param {string}      [workingDir]    Working directory for tests
 * @constructor
 */
var Parser = function(exePath, args, workingDir) {
    this.results = [];
    this.passedTests = [];
    this.failedTests = [];
    var self = this,
        spawnOptions = {},
        latestResult = null,
        latestAttribute = {
            key: '',
            value: ''
        },
        startParsing = false,
        stopParsing = false,
        child;
    if (workingDir) {
        spawnOptions.cwd = workingDir;
    }
    child = spawn(exePath, args, spawnOptions);
    child.stdout.on('data', function(data) {
        data = data.toString();

        // Skip the rest if we've already stopped parsing
        if (startParsing && stopParsing) {
            return;
        }

        // Parse it all line by line
        var lines = data.split('\r\n');
        for (var i = 0, len = lines.length; i < len; i++) {
            var line = lines[i];
            // Deal with extra breaks from the split
            if (line.length === 0) {
                continue;
            }

            // Don't start parsing until we see results
            if (!startParsing) {
                startParsing = isBeginMarker(line);
                continue;
            } else if (isEndMarker(line)) {
                stopParsing = true;
                // Push in the last result
                self._pushResult(latestResult, latestAttribute);
                return;
            }

            // Start parsing a new test result
            if (isNewTest(line)) {
                self._pushResult(latestResult, latestAttribute);
                var statusAndName = line.split(/ +/);
                latestResult = {
                    status: statusAndName[0],
                    name: statusAndName[1]
                };
            } else if (isAttribute(line)) {
                // Just in case we've been building up another attribute
                if (latestAttribute.value.length > 0) {
                    latestResult[latestAttribute.key] = latestAttribute.value;
                }

                var keyAndValue = line.split(' = '),
                    key = keyAndValue[0].replace(/\[|\]/g, ''),
                    value = keyAndValue[1];
                if (latestResult === null) {
                    self.emit('error', 'Unexpected attribute: ' + key + '\nLine: ' + line);
                } else {
                    latestAttribute = {
                        key: key,
                        value: value
                    };
                }
            } else {
                // Must be a continuing attribute
                if (latestAttribute.value.length === 0) {
                    self.emit('Expected continuing attribute but got: ' + line);
                    return;
                }
                latestAttribute.value += '\r\n' + line;
            }
        }
    });
    child.stderr.on('data', function(err) {
        self.emit('error', err);
    });
    child.on('close', function() {
        self.emit('done', self.results, self.passedTests, self.failedTests);
    });
};

Parser.prototype = Object.create(EventEmitter.prototype);

Parser.prototype._pushResult = function(result, attribute) {
    if (result === null) {
        return;
    }
    if (attribute.value.length > 0) {
        result[attribute.key] = attribute.value;
    }
    attribute.key = '';
    attribute.value = '';
    this.results.push(result);
    if (result.status === 'Passed') {
        result.passed = true;
        this.passedTests.push(result);
    } else {
        result.passed = false;
        this.failedTests.push(result);
    }
    this.emit('test', result);
};

module.exports = Parser;