# mstest

Provides an interface for MSTest and parses test output.

## Install

    npm install mstest

## Usage Example

```javascript
var MSTest = require('mstest');

var msTest = new MSTest();
msTest.testContainer = '/path/to/test.dll';
msTest.details.errorMessage = true;
msTest.details.errorStackTrace = true;
msTest.runTests({
    eachTest: function(test) {
        console.log(test.status + ' - ' + test.name);
    },
    done: function(results, passed, failed) {
        console.log(passed.length + '/' + results.length);
    }
});
```

## API

### *new* MSTest()

#### Properties

* *string* **exePath:** Path to mstest.exe
* *string* **workingDir:** Directory to execute the tests from
* *bool* **noIsolation:** (Default: false) If true, tests will run within the MSTest.exe process
* *string* **testSettings:** Path to a test settings file
* *string* **runConfig:** Path to a run configuration file
* *string* **resultsFiles:** Where to save the results
* *bool* **debugLog:** (Default: false) If true, will print out simple debug messages to stdout
* *object* **details:** Each key that is set to true will be treated as an additional detail. Keys are converted to lowercase when processing. See [Microsoft's MSTest.exe Command-Line Options][1] for a list of any valid details. Below is listed some examples
    * *bool* **duration**
    * *bool* **errorMessage/errormessage**
    * *bool* **errorStackTrace/errorstacktrace**

#### Methods
*All methods support chaining*

* **addTestList**( *string* testList ): Adds a new test list option
* **removeTestList**( *string* testList ): Removes a test list option
* **clearTestLists**(): Removes all test list options
* **setCategory**( *string* category ): Sets the category option. Allow logical operators will do this if no other categories are set
* **andCategory**( *string* category ): Adds another category using "and" (i.e. ...&category)
* **orCategory**( *string* category ): Adds another category using "or" (i.e. ...|category)
* **notCategory**( *string* category ): Adds another category using "not" (i.e. ...!category)
* **andNotCategory**( *string* category ): Adds another category using "and not" (i.e. ...&!category)
* **removeCategory**( *string* category ): Removes a previously added category. Uses *notCategory* to blacklist a category
* **addTest**( *string* test ): Adds a test case filter
* **removeTest**( *string* test ): Removes a test case filter
* **clearTests**(): Clears all test case filters
* **publish**( *object* options ): Prepares the tests to be published to a TFS server
    * *string* **options.server:** TFS server (i.e. http://TFSMachine:8080)
    * *string* **options.buildName:** Name of the build. See [/publishbuild][2] for how to find this value
    * *string* **options.flavor:** Must match the value set in the build (i.e. debug, release, etc.)
    * *string* **options.platform:** Must match the value set in the build (i.e. AnyCPU, x86, etc.)
    * *string* **options.teamProject:** Name of the team project the build belongs to
    * *string* **[options.resultsFile]:** (Optional) Name of the results file to publish. Only set when publishing previous test results
* **dontPublish**(): Clears any publish settings
* **runTests**( *object* **[options]** ): Runs the tests with the current settings
    * *function( TestResult )* **[options.eachTest]:** Called after each test is completed
    * *function( TestResult[] results, TestResult[] passed, TestResult[] failed )* **[options.done]:** Called after all of the tests have run
    * *function( * )* **[options.error]:**  Called when an error happens


  [1]: http://msdn.microsoft.com/en-us/library/ms182489.aspx
  [2]: http://msdn.microsoft.com/en-us/library/ms243151.aspx