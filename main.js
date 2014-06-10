'use strict';

var fs = require('fs'),
	path = require('path'),
	Parser = require('./parser.js'),

    _requiredPublishOptions = ['server', 'buildName', 'flavor', 'platform', 'teamProject'],
	_exePath = null;
	
/**
 * Runs tests through MSTest and reports results
 * @constructor
 */
var MSTest = function() {
	this._testContainer = '';
	this._testMetadata = '';
	this._testLists = [];
	this._categories = [];
	this._tests = [];

    this.workingDir = '';
	this.noIsolation = false;
	this.testSettings = '';
	this.runConfig = '';
	this.resultsFile = '';
    this._publish = null;
	this.details = {
		adapter: false,
		computerName: false,
		debugTrace: false,
		description: false,
		displayText: false,
		duration: false,
		errorMessage: false,
		errorStackTrace: false,
		executionID: false,
		groups: false,
		ID: false,
		isAutomated: false,
		link: false,
		longText: false,
		name: false,
		outcomeText: false,
		owner: false,
		parentExeCID: false,
		priority: false,
		projectName: false,
		projectRelativePath: false,
		readOnly: false,
		spoolMessage: false,
		stderr: false,
		stdout: false,
		storage: false,
		testCategoryID: false,
		testName: false,
		testType: false,
		traceInfo: false
		// ... Any details you might need
	};
	
	this.debugLog = false;
};

/**
 * Logs out debug information
 */
MSTest.prototype._log = function() {
	if (this.debugLog) {
        process.stdout.write('[MSTest] ');
		console.log.apply(console, arguments);
	}
};

/**
 * Adds a new test list option
 * @param {string} testList
 * @returns {MSTest}
 */
MSTest.prototype.addTestList = function(testList) {
	if (this._testLists.indexOf(testList) === -1) {
		this._testLists.push(testList);
	}
	return this;
};

/**
 * Removes a test list option
 * @param {string} testList
 * @returns {MSTest}
 */
MSTest.prototype.removeTestList = function(testList) {
	var index = this._testLists.indexOf(testList);
	if (index !== -1) {
		this._testLists.splice(index, 1);
	}
	return this;
};

/**
 * Removes all test list options
 * @returns {MSTest}
 */
MSTest.prototype.clearTestLists = function() {
	this._testLists = [];
	return this;
};

/**
 * Sets the only category
 * @returns {MSTest}
 */
MSTest.prototype.setCategory = function(category) {
	this._categories = [category];
	return this;
};

/**
 * Adds a new category with an operator
 * @param {string} operator
 * @param {string} category
 */
MSTest.prototype._appendCategory = function(operator, category) {
	var len = this._categories.length;
	if (len === 0) {
		this._categories = [category];
	} else {
		this._categories.splice(len, 0, operator, category);
	}
};

/**
 * Adds another category using "and" (...&category)
 * @returns {MSTest}
 */
MSTest.prototype.andCategory = function(category) {
	this._appendCategory('&', category);
	return this;
};

/**
 * Adds another category using "or" (...|category)
 * @returns {MSTest}
 */
MSTest.prototype.orCategory = function(category) {
	this._appendCategory('|', category);
	return this;
};

/**
 * Adds another category using "not" (...!category)
 * @returns {MSTest}
 */
MSTest.prototype.notCategory = function(category) {
	this._appendCategory('!', category);
	return this;
};

/**
 * Adds another category using "and not" (...&!category)
 * @returns {MSTest}
 */
MSTest.prototype.andNotCategory = function(category) {
	this._appendCategory('&!', category);
	return this;
};

/**
 * Removes a category from the list
 * @param {string} category
 * @returns {MSTest}
 */
MSTest.prototype.removeCategory = function(category) {
	var index = this._categories.indexOf(category);
	if (index > 0) {
		// Remove the category and it's previous operator
		this._categories.splice(index - 1, 2);
	} else if (index === 0) {
		// It was the first one, just pull it out
		this._categories.shift();
	}
	return this;
};

/**
 * Adds a test case to run
 * @param {string} test
 * @returns {MSTest}
 */
MSTest.prototype.addTest = function(test) {
	if (this._tests.indexOf(test)) {
		this._tests.push(test);
	}
	return this;
};

/**
 * Removes a test case to run (only removes from the explicit list, does not blacklist)
 * @param {string} test
 * @returns {MSTest}
 */
MSTest.prototype.removeTest = function(test) {
	var index = this._tests.indexOf(test);
	if (index !== -1) {
		this._tests.splice(index, 1);
	}
	return this;
};

/**
 * Clears tests, will run all tests
 * @returns {MSTest}
 */
MSTest.prototype.clearTests = function() {
	this._tests = [];
	return this;
};

/**
 * Prepares the tests to be published to a TFS server
 * @param {object} options
 * @param {string} options.server           TFS server (i.e. http://TFSMachine:8080)
 * @param {string} options.buildName        Name of the build. Check /publishbuild for how to get this value
 * @param {string} options.flavor           Must match the value set in the build (i.e. debug, release, etc.)
 * @param {string} options.platform         Must match the value set in the build (i.e. AnyCPU, x86, etc.)
 * @param {string} options.teamProject      Name of the team project the build belongs to
 * @param {string} [options.resultsFile]    Name of the results file to publish. Only set for publishing old results
 * @returns {MSTest}
 */
MSTest.prototype.publish = function(options) {
    _requiredPublishOptions.forEach(function(val) {
        if (!options.hasOwnProperty(val)) {
            throw new Error('All of the following options must be given to publish: ' + _requiredPublishOptions);
        }
    });
    this._publish = options;
    return this;
};

/**
 * Clears publish settings
 * @returns {MSTest}
 */
MSTest.prototype.dontPublish = function() {
    this._publish = null;
    return this;
};

/**
 * Runs the tests with the current settings
 * @param {object}                  [options]
 * @param {function(TestResult)}    [options.eachTest]  Called for every test result
 * @param {function(TestResult[])}  [options.done]      Called after all the tests have completed
 * @param {function(Error)}         [options.error]     Called if there was an error in the parser
 * @returns {MSTest}
 */
MSTest.prototype.runTests = function(options) {
    options = options || {};
    options.eachTest = options.eachTest || function(){};
    options.done = options.done || function(){};
    options.error = options.error || function(){};

	var msTestArgs = ['/nologo']; // Less to parse
	// Figure out where we're getting the tests from
	if (this.testContainer) {
		msTestArgs.push('/testcontainer:"' + this.testContainer + '"');
	} else if (this.testMetadata) {
		msTestArgs.push('/testmetadata:"' + this.testMetadata + '"');
	} else {
		throw new Error('Must specify a test container or test metadata');
	}
	
	// Append any category filters
	if (this._categories.length > 0) {
		msTestArgs.push('/category:"' + this._categories.join('') + '"');
	}
	
	// Add any test filters
	for (var i = 0, len = this._tests.length; i < len; i++) {
		msTestArgs.push('/test:' + this._tests[i]);
	}
	
	// Run tests inside the mstest.exe process
	if (this.noIsolation) {
		msTestArgs.push('/noisolation');
	}
	
	// Specify a test settings file
	if (this.testSettings) {
		msTestArgs.push('/testsettings:"' + this.testSettings + '"');
	}
	
	// Specify the run configuration file
	if (this.runConfig) {
		msTestArgs.push('/runconfig:"' + this.runConfig + '"');
	}
	
	// Save the results somewhere special
	if (this.resultsFile) {
		msTestArgs.push('/resultsfile:"' + this.resultsFile + '"');
	}

	// Add all extra details
	for (var detail in this.details) {
        if (this.details[detail]) {
            msTestArgs.push('/detail:' + detail.toLowerCase());
        }
	}

    // Add any publish settings
    if (this._publish) {
        msTestArgs.push('/publish:' + this._publish.server);
        msTestArgs.push('/publishbuild:' + this._publish.buildName);
        msTestArgs.push('/flavor:' + this._publish.flavor);
        msTestArgs.push('/platform:' + this._publish.platform);
        msTestArgs.push('/teamproject:' + this._publish.teamProject + '');
        if (this._publish.resultsFile) {
            msTestArgs.push('/publishresultsfile:"' + this._publish.resultsFile + '"');
        }
    }

    this._log('mstest.exe path: ' + this.exePath);
    this._log('Arguments: ' + msTestArgs.join(' '));
    this._log('CMD: ' + this.exePath + ' ' + msTestArgs.join(' '));

    // Fire it up!
    var parser = new Parser(this.exePath, msTestArgs, this.workingDir, Object.keys(this.details));
    parser.on('test', options.eachTest);
    parser.on('done', options.done);
    parser.on('error', options.error);
    return this;
};

Object.defineProperty(MSTest.prototype, 'testContainer', {
	get: function() { return this._testContainer; },
	set: function(value) {
		// Clear the metadata path since we can't have both
		this._log('Can only have testContainer or testMetadata, clearing testMetadata');
		this._testMetadata = '';
		this._testContainer = value;
	}
});

Object.defineProperty(MSTest.prototype, 'testMetadata', {
	get: function() { return this._testMetadata; },
	set: function(value) {
		// Clear the testcontainer since we can't have both
		this._log('Can only have testContainer or testMetadata, clearing testContainer');
		this._testContainer = '';
		this._testMetadata = value;
	}
});

// Get the path to mstest.exe
Object.defineProperty(MSTest.prototype, 'exePath', {
	get: function() {
		if (_exePath !== null) {
			return _exePath;
		}
		
		// Environment variables for VS tools
        var vsToolsVariables = [
				process.env.VS120COMNTOOLS,
				process.env.VS110COMNTOOLS,
				process.env.VS100COMNTOOLS
			],
			vsTools = null;
		
		for (var i = 0, len = vsToolsVariables.length; i < len; i++) {
			var toolPath = vsToolsVariables[i];
			if (toolPath && toolPath !== '') {
				vsTools = toolPath;
				break;
			}
		}
		
		if (!vsTools) {
			throw new Error('Could not find path to Visual Studio tools');
		}
		
		_exePath = path.join(vsTools, '../IDE', 'mstest.exe');
		if (!fs.existsSync(_exePath)) {
			throw new Error('Could not find mstest.exe at ' + _exePath);
		}
		
		return _exePath;
	}
});

module.exports = MSTest;