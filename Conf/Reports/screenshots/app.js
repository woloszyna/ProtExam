var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Displays header on Customer's Login Page|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002b0081-0026-004f-00d1-005c00fb00e7.png",
        "timestamp": 1599301976964,
        "duration": 4332
    },
    {
        "description": "Shows all login options in the dropdown|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008300fb-007c-00e4-00fe-0044008c0032.png",
        "timestamp": 1599301981796,
        "duration": 759
    },
    {
        "description": "can login as Hermoine Granger|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ec0093-00d3-00ff-0085-002e00100047.png",
        "timestamp": 1599301982941,
        "duration": 1516
    },
    {
        "description": "can login as Harry Potter|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fe0024-00d3-0029-0068-0088009400ea.png",
        "timestamp": 1599301984844,
        "duration": 584
    },
    {
        "description": "can login as Ron Weasly|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160088-0072-000c-00ea-006600170054.png",
        "timestamp": 1599301985806,
        "duration": 678
    },
    {
        "description": "can login as Albus Dumbledore|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0061008d-0043-0040-00d6-000f0009006a.png",
        "timestamp": 1599301986877,
        "duration": 596
    },
    {
        "description": "can login as Neville Longbottom|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cf00b8-00a5-00ae-0009-00fc00da0035.png",
        "timestamp": 1599301987865,
        "duration": 712
    },
    {
        "description": "can log in and log out successfully|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea00b9-00a9-0076-0080-00730017007c.png",
        "timestamp": 1599301988980,
        "duration": 735
    },
    {
        "description": "Displays header on Landing Page|It should be possible to access customer's area",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73290,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00000017-0021-00f8-0016-006c004f0051.png",
        "timestamp": 1599301990093,
        "duration": 512
    },
    {
        "description": "Displays header on Customer's Login Page|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007100cd-0022-0058-0033-009a00f500d4.png",
        "timestamp": 1599302164948,
        "duration": 2886
    },
    {
        "description": "Shows all login options in the dropdown|Customer's Login Page verification",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: Cannot read property 'click' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'click' of undefined\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:19:44)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Shows all login options in the dropdown\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00bc0066-0081-00cd-0091-00b800cc002c.png",
        "timestamp": 1599302168334,
        "duration": 939
    },
    {
        "description": "can login as Hermoine Granger|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a50004-00bb-00a2-0075-0027003900bf.png",
        "timestamp": 1599302169650,
        "duration": 1322
    },
    {
        "description": "can login as Harry Potter|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00500084-0067-0081-00b9-00ac004b00d7.png",
        "timestamp": 1599302171338,
        "duration": 673
    },
    {
        "description": "can login as Ron Weasly|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0069006d-00c3-00b8-001d-0089008b0079.png",
        "timestamp": 1599302172369,
        "duration": 645
    },
    {
        "description": "can login as Albus Dumbledore|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a700af-0056-005e-0068-00e6008c00cd.png",
        "timestamp": 1599302173369,
        "duration": 484
    },
    {
        "description": "can login as Neville Longbottom|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d0017-001d-00df-0096-00d300b500f5.png",
        "timestamp": 1599302174236,
        "duration": 663
    },
    {
        "description": "can log in and log out successfully|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008500db-007c-0079-0049-00b200f800d4.png",
        "timestamp": 1599302175258,
        "duration": 667
    },
    {
        "description": "Displays header on Landing Page|It should be possible to access customer's area",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73474,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e40029-00e8-0024-0063-007c00bf00de.png",
        "timestamp": 1599302176291,
        "duration": 472
    },
    {
        "description": "Displays header on Customer's Login Page|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001c00ac-00ce-002c-0054-009300bd0010.png",
        "timestamp": 1599302438103,
        "duration": 3374
    },
    {
        "description": "Shows all login options in the dropdown|Customer's Login Page verification",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: Cannot read property 'click' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'click' of undefined\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:19:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Shows all login options in the dropdown\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "000d00f2-00d4-00f7-0032-00b000f4001e.png",
        "timestamp": 1599302441959,
        "duration": 856
    },
    {
        "description": "can login as Hermoine Granger|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e00c5-00d0-0088-0022-00b2006800d7.png",
        "timestamp": 1599302443271,
        "duration": 906
    },
    {
        "description": "can login as Harry Potter|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c2000e-0093-0056-0017-009f00d800ea.png",
        "timestamp": 1599302444566,
        "duration": 762
    },
    {
        "description": "can login as Ron Weasly|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001000c9-0038-00c0-00d8-006300800019.png",
        "timestamp": 1599302445688,
        "duration": 715
    },
    {
        "description": "can login as Albus Dumbledore|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001400d9-00a1-003a-0037-00b7005c0096.png",
        "timestamp": 1599302446767,
        "duration": 658
    },
    {
        "description": "can login as Neville Longbottom|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001700d5-0038-003c-00a4-0043004d006b.png",
        "timestamp": 1599302447786,
        "duration": 677
    },
    {
        "description": "can log in and log out successfully|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0028003e-0059-0013-00fa-0064006e00d5.png",
        "timestamp": 1599302448838,
        "duration": 499
    },
    {
        "description": "Displays header on Landing Page|It should be possible to access customer's area",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 73676,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00880034-00c6-0035-00ec-00e900ad00b2.png",
        "timestamp": 1599302449697,
        "duration": 305
    },
    {
        "description": "Displays header on Customer's Login Page|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a9003a-00be-00da-0026-00be00090009.png",
        "timestamp": 1599314899741,
        "duration": 3803
    },
    {
        "description": "Shows all login options in the dropdown|Customer's Login Page verification",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: Cannot read property 'click' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'click' of undefined\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:19:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Shows all login options in the dropdown\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "009f0007-004c-00ec-006c-002700680042.png",
        "timestamp": 1599314904556,
        "duration": 1183
    },
    {
        "description": "can login as Hermoine Granger|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005800fa-00cb-00aa-00d0-00e000f10011.png",
        "timestamp": 1599314906758,
        "duration": 2360
    },
    {
        "description": "can login as Harry Potter|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c00065-0021-00ef-0076-00b200d9000d.png",
        "timestamp": 1599314909832,
        "duration": 1743
    },
    {
        "description": "can login as Ron Weasly|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0041003e-00bf-002d-00f9-00af003e00e8.png",
        "timestamp": 1599314912503,
        "duration": 1698
    },
    {
        "description": "can login as Albus Dumbledore|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cd006c-0058-00c4-00ab-005d001600cf.png",
        "timestamp": 1599314914827,
        "duration": 1733
    },
    {
        "description": "can login as Neville Longbottom|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a0042-005d-0087-00c7-00fd003e007f.png",
        "timestamp": 1599314917174,
        "duration": 860
    },
    {
        "description": "can log in and log out successfully|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003c00be-0010-0046-00e9-00730022009c.png",
        "timestamp": 1599314918644,
        "duration": 1493
    },
    {
        "description": "Displays header on Landing Page|It should be possible to access customer's area",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 74092,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff0085-00e9-0050-008f-00f40097009f.png",
        "timestamp": 1599314920734,
        "duration": 909
    },
    {
        "description": "Displays header on Customer's Login Page|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d300c0-00b5-00af-00b3-004200840078.png",
        "timestamp": 1599408214998,
        "duration": 2786
    },
    {
        "description": "Shows all login options in the dropdown|Customer's Login Page verification",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": [
            "Failed: Cannot read property 'click' of undefined"
        ],
        "trace": [
            "TypeError: Cannot read property 'click' of undefined\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:19:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"Shows all login options in the dropdown\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customers_LoginPage_verification.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "002f0083-00c8-00da-0094-00e000fe00d6.png",
        "timestamp": 1599408218258,
        "duration": 682
    },
    {
        "description": "can login as Hermoine Granger|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a900c3-00a4-00ef-00d5-00a4001d00b4.png",
        "timestamp": 1599408219440,
        "duration": 886
    },
    {
        "description": "can login as Harry Potter|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da009f-007c-0037-00ef-00d8000b005c.png",
        "timestamp": 1599408220743,
        "duration": 453
    },
    {
        "description": "can login as Ron Weasly|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008200d0-001d-0090-006c-00bb00b000c2.png",
        "timestamp": 1599408221581,
        "duration": 483
    },
    {
        "description": "can login as Albus Dumbledore|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd00e7-0073-000c-00a8-0077003500fb.png",
        "timestamp": 1599408222441,
        "duration": 802
    },
    {
        "description": "can login as Neville Longbottom|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f6009c-00f9-0069-00b3-009000170084.png",
        "timestamp": 1599408223610,
        "duration": 662
    },
    {
        "description": "can log in and log out successfully|Customer's Login Page verification",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000c001b-0026-00d4-00bc-00c20061003e.png",
        "timestamp": 1599408224637,
        "duration": 575
    },
    {
        "description": "Displays header on Landing Page|It should be possible to access customer's area",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 85603,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.83"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00280086-0065-0068-0049-0001000b00ce.png",
        "timestamp": 1599408225575,
        "duration": 468
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
