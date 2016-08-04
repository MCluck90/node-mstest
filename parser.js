'use strict';

var localizationTable = require('./localization.json');


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
    return (/\d/).test(line[0]) || line.indexOf(this.translatedMessages.FinalTestResults) === 0;
}

/**
 * Determines if this line marks the beginning of a new test result
 * @param {string} line
 * @returns {boolean}
 */
function isNewTest(line) {
    var possibleResults = [this.translatedMessages.Passed, this.translatedMessages.Failed, this.translatedMessages.Inconclusive];
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
    //return line.indexOf("\t") != 0;
    return line.indexOf('[') === 0;
}

/**
 * Runs and parses MSTest results on the command-line
 * @param {string}      exePath         Path to mstest.exe
 * @param {string[]}    args            Additional arguments
 * @param {string}      [workingDir]    Working directory for tests
 * @param {string[]}    [detailsMap]    Map details to user-defined property names
 * @constructor
 */
var Parser = function (exePath, args, workingDir, detailsMap, language) {
    this.results = [];
    this.passedTests = [];
    this.failedTests = [];
    this.detailsMap = detailsMap;
    this.language = language || 'en';
    this.translatedMessages = localizationTable[this.language];

    this.isAttribute = isAttribute;
    this.isNewTest = isNewTest;
    this.isEndMarker = isEndMarker;
    this.isBeginMarker = isBeginMarker;

    if (this.translatedMessages === undefined) {
        this.translatedMessages = localizationTable['en'];
    }

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
    child.stdout.on('data', function (data) {
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
                startParsing = self.isBeginMarker(line);
                continue;
            } else if (self.isEndMarker(line)) {
                stopParsing = true;
                // Push in the last result
                self._pushResult(latestResult, latestAttribute);
                return;
            }

            // Start parsing a new test result
            if (self.isNewTest(line)) {
                self._pushResult(latestResult, latestAttribute);
                var statusAndName = line.split(/ +/);
                latestResult = {
                    status: statusAndName[0],
                    name: statusAndName[1]
                };
            } else if (self.isAttribute(line)) {
                // Just in case we've been building up another attribute
                if (latestAttribute.value.length > 0) {
                    self._setAttribute(latestResult, latestAttribute.key, latestAttribute.value);
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
    child.stderr.on('data', function (err) {
        self.emit('error', err.toString());
    });
    child.on('close', function () {
        self.emit('done', self.results, self.passedTests, self.failedTests);
    });
};

Parser.prototype = Object.create(EventEmitter.prototype);

/**
 * Adds a new test result
 * @param {TestResult}  result
 * @param {object}      attribute
 * @private
 */
Parser.prototype._pushResult = function (result, attribute) {
    if (result === null) {
        return;
    }
    if (attribute.value.length > 0) {
        this._setAttribute(result, attribute.key, attribute.value);
    }
    attribute.key = '';
    attribute.value = '';
    this.results.push(result);
    if (result.status === this.translatedMessages.Passed) {
        result.passed = true;
        this.passedTests.push(result);
    } else {
        result.passed = false;
        this.failedTests.push(result);
    }
    this.emit('test', result);
};

/**
 * Sets an attribute
 * @param {TestResult}  result
 * @param {string}      key
 * @param {*}           value
 * @private
 */
Parser.prototype._setAttribute = function (result, key, value) {
    for (var i = 0, len = this.detailsMap.length; i < len; i++) {
        if (this.detailsMap[i].toLowerCase() === key) {
            key = this.detailsMap[i];
            break;
        }
    }

    result[key] = value;
};

module.exports = Parser;

/**
 * @name TestResult
 * @property {string} status
 * @property {boolean} passed
 * @property {string} @detailName
 */