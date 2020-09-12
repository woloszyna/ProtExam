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
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0056000a-004b-00c5-008c-0079001c0097.png",
        "timestamp": 1599939318532,
        "duration": 3275
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c0044-00bc-00e1-008a-001f00a50089.png",
        "timestamp": 1599939322265,
        "duration": 469
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00be00b6-00cd-007f-0017-0095001b00ea.png",
        "timestamp": 1599939323117,
        "duration": 1015
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00420085-005d-0024-004e-00c700cc00e4.png",
        "timestamp": 1599939324586,
        "duration": 556
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00010059-00b2-0046-0061-001b009400c5.png",
        "timestamp": 1599939325511,
        "duration": 1080
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0016008d-00af-00ff-0008-0081004f005c.png",
        "timestamp": 1599939326967,
        "duration": 710
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00240076-0004-001e-0025-00a80048004d.png",
        "timestamp": 1599939328051,
        "duration": 760
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c50022-00ea-003e-0040-005700160013.png",
        "timestamp": 1599939329195,
        "duration": 373
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca00ce-00c3-00ea-00d8-004700ed008f.png",
        "timestamp": 1599939329944,
        "duration": 636
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00980022-00d8-00d4-0072-0099005c00ac.png",
        "timestamp": 1599939330945,
        "duration": 485
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00df00a5-0035-00e7-0053-0034003b00aa.png",
        "timestamp": 1599939331811,
        "duration": 575
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2430,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00340070-00d1-00ca-0070-003800620053.png",
        "timestamp": 1599939332740,
        "duration": 513
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2754,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a8006a-0030-0097-003d-006500e9005f.png",
        "timestamp": 1599939999185,
        "duration": 3280
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 2754,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00360017-00eb-0049-0037-003c008b006d.png",
        "timestamp": 1599940002943,
        "duration": 615
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4326,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:13:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at BankManagerLogin.verifyHeaderText (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/BankManagerLogin.js:9:23)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:17:43)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Header displayed on Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c200ae-0011-0056-001b-00720033002b.png",
        "timestamp": 1599945804945,
        "duration": 102
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4326,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:13:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"All elements are displayed on the Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:21:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:9:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cc001e-005a-0077-0020-0073001f0055.png",
        "timestamp": 1599945805672,
        "duration": 13
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4414,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at BankManagerLogin.verifyHeaderText (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/BankManagerLogin.js:9:23)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:12:43)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Header displayed on Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ce0007-00ca-005d-004a-005400b8007b.png",
        "timestamp": 1599945882760,
        "duration": 44
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4414,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"All elements are displayed on the Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00fc0006-0011-0014-0017-00a800bf0017.png",
        "timestamp": 1599945883281,
        "duration": 12
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4601,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at BankManagerLogin.verifyHeaderText (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/BankManagerLogin.js:9:23)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:12:43)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Header displayed on Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00260034-00bc-00d3-00f2-0096003000c8.png",
        "timestamp": 1599945982040,
        "duration": 36
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4601,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"All elements are displayed on the Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b500f1-0075-00c3-00f6-00fa008e00bf.png",
        "timestamp": 1599945982596,
        "duration": 13
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at BankManagerLogin.verifyHeaderText (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/BankManagerLogin.js:9:23)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:12:43)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Header displayed on Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "003500b1-004e-0052-0010-005d009b0056.png",
        "timestamp": 1599946041776,
        "duration": 21
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: LandingPage.accessBankManagerLogin is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LandingPage.accessBankManagerLogin is not a function\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:8:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at /usr/local/lib/node_modules/protractor/built/browser.js:461:23\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"All elements are displayed on the Bank Manager's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:16:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_LoginFunctionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0047005f-0047-0013-0006-00ef00bf007f.png",
        "timestamp": 1599946042376,
        "duration": 18
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a600be-0006-00b0-0052-00f1009f00ba.png",
        "timestamp": 1599946042779,
        "duration": 3490
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000a00d5-0016-0023-00c2-003800d2008f.png",
        "timestamp": 1599946046678,
        "duration": 568
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ef0064-00c1-00f5-00d6-004000520089.png",
        "timestamp": 1599946047629,
        "duration": 1069
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00050002-00c0-00e2-008f-005b00ce0008.png",
        "timestamp": 1599946049079,
        "duration": 562
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00790051-00be-0028-00a3-0005001000a2.png",
        "timestamp": 1599946050016,
        "duration": 637
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f000f3-0087-00d7-00a9-00cc00ab00aa.png",
        "timestamp": 1599946051015,
        "duration": 637
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a50030-00b8-0050-00ca-00eb00c60016.png",
        "timestamp": 1599946052021,
        "duration": 657
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0013006b-00ed-008c-0041-004b00630047.png",
        "timestamp": 1599946053039,
        "duration": 658
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00750088-0009-00bb-00c5-008600d90076.png",
        "timestamp": 1599946054067,
        "duration": 596
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4682,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f300be-0044-001f-00af-00dc00060055.png",
        "timestamp": 1599946055035,
        "duration": 502
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e0035-0031-001f-00d5-00c800160073.png",
        "timestamp": 1599946189762,
        "duration": 3230
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a40073-00c8-0033-00a9-00e800160055.png",
        "timestamp": 1599946193514,
        "duration": 608
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d6002c-0056-006e-0046-001f002700f9.png",
        "timestamp": 1599946194485,
        "duration": 1269
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00da00ec-00f3-00bc-0018-004e00ba0014.png",
        "timestamp": 1599946196116,
        "duration": 586
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d000d8-0093-008d-006b-00b000700080.png",
        "timestamp": 1599946197082,
        "duration": 1388
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ca009c-00bd-00c9-00f3-004f006b00e7.png",
        "timestamp": 1599946198862,
        "duration": 938
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00de0059-003e-0003-00a0-00c000630047.png",
        "timestamp": 1599946200171,
        "duration": 551
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009f0053-00d9-0070-00d1-009c00d7003d.png",
        "timestamp": 1599946201090,
        "duration": 526
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003600cd-002f-00d3-00cd-00d100da00eb.png",
        "timestamp": 1599946201987,
        "duration": 639
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006a00f0-00e5-004e-0079-00340025008c.png",
        "timestamp": 1599946202984,
        "duration": 661
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0085007d-009d-00c3-0013-00a100870064.png",
        "timestamp": 1599946204017,
        "duration": 571
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 4851,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0094002c-00d6-00f7-0003-006900c10082.png",
        "timestamp": 1599946204963,
        "duration": 338
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bb005d-0022-002b-00d7-0021002a0038.png",
        "timestamp": 1599949984060,
        "duration": 3214
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb0043-008a-0048-0079-00ec000800d8.png",
        "timestamp": 1599949987783,
        "duration": 772
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Failed: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "NoSuchAlertError: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:546:15)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at TargetLocator.alert (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1862:29)\n    at new AddCustomer (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/AddCustomer.js:17:36)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/AddCustomer.js:42:18)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)\n    at Module.require (internal/modules/cjs/loader.js:1090:19)\n    at require (internal/modules/cjs/helpers.js:75:18)\nFrom: Task: Run it(\"Bank Account Manager can access 'Add Customer' page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:27:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a30010-00d8-0065-00e5-0054004b0061.png",
        "timestamp": 1599949988942,
        "duration": 713
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002b00d2-00cb-0043-00d5-0036008c0051.png",
        "timestamp": 1599949990063,
        "duration": 338
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00940087-0034-0063-00ed-00630063003b.png",
        "timestamp": 1599949990778,
        "duration": 370
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:546:15)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at TargetLocator.alert (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1862:29)\n    at new AddCustomer (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/AddCustomer.js:17:36)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/AddCustomer.js:42:18)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)\n    at Module.require (internal/modules/cjs/loader.js:1090:19)\n    at require (internal/modules/cjs/helpers.js:75:18)\nFrom: Task: Run it(\"Bank Account Manager can access 'Add Customer' page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:27:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)\nFrom: Task: Run it(\"Customer can be successfully created\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:51:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00810086-006d-006f-00fc-0075008a00b6.png",
        "timestamp": 1599949991535,
        "duration": 914
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001a0096-00e2-0092-0084-0089002d005f.png",
        "timestamp": 1599949992863,
        "duration": 951
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c3001c-001d-0002-00f0-00c900f000f3.png",
        "timestamp": 1599949994203,
        "duration": 537
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00190046-0032-00f8-0073-008d00bf0044.png",
        "timestamp": 1599949995096,
        "duration": 1363
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e80002-00c5-00f4-00c3-004c00e900b9.png",
        "timestamp": 1599949996820,
        "duration": 652
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002f0077-0001-00e8-00a4-000e00a60038.png",
        "timestamp": 1599949997835,
        "duration": 657
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed006d-00ab-00e9-0039-000c00da0069.png",
        "timestamp": 1599949998854,
        "duration": 637
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e10043-0047-00d3-00a7-00f3003400db.png",
        "timestamp": 1599949999854,
        "duration": 641
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d90041-0022-002d-0019-00fd006900e3.png",
        "timestamp": 1599950000853,
        "duration": 650
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e300ed-004c-0099-00d2-0092009500a8.png",
        "timestamp": 1599950001866,
        "duration": 583
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6497,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00740025-0035-00d1-009e-00250035007b.png",
        "timestamp": 1599950002826,
        "duration": 490
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00020058-007b-007b-0078-008b00de0093.png",
        "timestamp": 1599950052577,
        "duration": 2838
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002c00bf-0080-004f-00b5-002100f60091.png",
        "timestamp": 1599950055884,
        "duration": 618
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "003300a3-00e7-00be-0008-0000003a00a6.png",
        "timestamp": 1599950056865,
        "duration": 851
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e60012-00ba-0053-00e8-00d400cf00bb.png",
        "timestamp": 1599950058112,
        "duration": 1012
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007500d7-008f-00ba-0032-001000f40007.png",
        "timestamp": 1599950059523,
        "duration": 606
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "NoSuchAlertError: no such alert\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:546:15)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.switchTo().alert()\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at TargetLocator.alert (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1862:29)\n    at AddCustomer.addCustomer (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/AddCustomer.js:36:40)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:53:21)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\nFrom: Task: Run it(\"Customer can be successfully created\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:51:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "007b0095-0080-00a7-00e4-000f00180007.png",
        "timestamp": 1599950060510,
        "duration": 727
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d0072-0078-009d-00a5-0012001d0003.png",
        "timestamp": 1599950061646,
        "duration": 1140
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0083004e-0064-0049-00a9-007900710013.png",
        "timestamp": 1599950063162,
        "duration": 536
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009c0022-00cd-0022-00cc-006d00ee0009.png",
        "timestamp": 1599950064082,
        "duration": 1044
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a200a7-00ea-009a-008a-00db00970092.png",
        "timestamp": 1599950065492,
        "duration": 665
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008f0062-0026-001a-001e-001e007b00df.png",
        "timestamp": 1599950066525,
        "duration": 634
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e00fb-0027-00e0-00fd-00e6000200e1.png",
        "timestamp": 1599950067526,
        "duration": 768
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a400eb-0057-0065-00ad-009200140068.png",
        "timestamp": 1599950068655,
        "duration": 524
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d00c4-0054-00ad-0015-00d0009f001f.png",
        "timestamp": 1599950069556,
        "duration": 484
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d0075-001b-00eb-00f5-002e0083001f.png",
        "timestamp": 1599950070406,
        "duration": 469
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6651,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008b005a-0000-00f9-00db-0064007b005a.png",
        "timestamp": 1599950071257,
        "duration": 504
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c90067-007b-0039-0030-00a900ff001c.png",
        "timestamp": 1599950090873,
        "duration": 2579
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f80029-00be-0012-00db-0037000c0041.png",
        "timestamp": 1599950093899,
        "duration": 459
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "004000e7-002b-00cb-0005-00da0054003c.png",
        "timestamp": 1599950094745,
        "duration": 1280
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00340033-005f-000d-0090-009200480071.png",
        "timestamp": 1599950096397,
        "duration": 404
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0017008d-00e2-0092-00ee-00e7001c0013.png",
        "timestamp": 1599950097186,
        "duration": 380
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fa00bf-003a-0035-0056-00f500a80072.png",
        "timestamp": 1599950097951,
        "duration": 667
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008100c4-00b4-00ef-009d-007600f00014.png",
        "timestamp": 1599950099013,
        "duration": 1269
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0092005a-0055-003c-00e7-007600260071.png",
        "timestamp": 1599950100641,
        "duration": 508
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002d0027-00c8-003f-002e-001f006d00d5.png",
        "timestamp": 1599950101536,
        "duration": 1174
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d00f8-00b7-0098-00cb-00a0009000ec.png",
        "timestamp": 1599950103072,
        "duration": 670
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b4003e-000c-0062-0043-000c009100d5.png",
        "timestamp": 1599950104105,
        "duration": 478
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00eb00ed-002c-0013-009f-002200c0009c.png",
        "timestamp": 1599950104957,
        "duration": 683
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e800bf-00ea-007e-00b3-00af00d50079.png",
        "timestamp": 1599950106005,
        "duration": 474
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006d0052-00f8-00c1-009a-0025005200cb.png",
        "timestamp": 1599950106858,
        "duration": 671
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00410056-00a6-00bb-0062-000300b800b8.png",
        "timestamp": 1599950107902,
        "duration": 478
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6765,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001b00a1-00ac-00cb-0039-00a900460085.png",
        "timestamp": 1599950108749,
        "duration": 320
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002000db-00b3-004c-00a5-009800ff0092.png",
        "timestamp": 1599950243209,
        "duration": 3177
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001900a5-0087-0011-0019-00f8004100e9.png",
        "timestamp": 1599950246938,
        "duration": 728
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009f0009-002c-009c-00bc-00e9005300b2.png",
        "timestamp": 1599950248030,
        "duration": 1004
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b300b8-006e-00aa-0020-00f000e800fd.png",
        "timestamp": 1599950249401,
        "duration": 309
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00dd0090-003d-0031-0097-0095008000c1.png",
        "timestamp": 1599950250095,
        "duration": 508
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000c00f9-00db-008b-0029-0056002d00b6.png",
        "timestamp": 1599950250984,
        "duration": 670
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e1001b-001a-0068-0063-00e400330085.png",
        "timestamp": 1599950252086,
        "duration": 552
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fa0047-0015-001c-00c3-00450054009b.png",
        "timestamp": 1599950252994,
        "duration": 513
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00760065-00ac-002d-009f-00ed0032008e.png",
        "timestamp": 1599950253874,
        "duration": 1044
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000200fc-008d-00b4-0013-004a00010077.png",
        "timestamp": 1599950255298,
        "duration": 635
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0042006e-003c-0055-0077-00320083005a.png",
        "timestamp": 1599950256291,
        "duration": 479
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "006600d3-0062-0046-00ef-00f800a00053.png",
        "timestamp": 1599950257129,
        "duration": 653
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e0041-0028-004e-006b-00b500550046.png",
        "timestamp": 1599950258145,
        "duration": 541
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d008b-009c-003d-0067-002f0027002f.png",
        "timestamp": 1599950259044,
        "duration": 546
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0007003e-000d-000c-006a-0009008900e3.png",
        "timestamp": 1599950259956,
        "duration": 580
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 6917,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002a0099-00b3-0003-0006-00e5001c0018.png",
        "timestamp": 1599950260907,
        "duration": 493
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f004e-00b1-0034-00a1-00f400910073.png",
        "timestamp": 1599950417614,
        "duration": 2823
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a0080-00a0-00b1-0093-00b800fc0007.png",
        "timestamp": 1599950420928,
        "duration": 715
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00c800a1-0097-0098-00a2-002e005c000f.png",
        "timestamp": 1599950422018,
        "duration": 1060
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000400a1-006a-0041-00ff-0036002500ec.png",
        "timestamp": 1599950423474,
        "duration": 397
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002f00b3-00b3-009d-007f-002600a900cf.png",
        "timestamp": 1599950424330,
        "duration": 486
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009600a7-0095-0050-0036-00630016008f.png",
        "timestamp": 1599950425203,
        "duration": 732
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fe00ca-0024-0075-0086-005f007f00ac.png",
        "timestamp": 1599950426350,
        "duration": 825
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0012006e-007e-0093-0013-00e30019009e.png",
        "timestamp": 1599950427549,
        "duration": 516
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00510032-00df-0029-0083-0027006a00ce.png",
        "timestamp": 1599950428425,
        "duration": 1033
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00630019-007d-00b5-000f-00f3004a007c.png",
        "timestamp": 1599950429829,
        "duration": 673
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990074-006f-00f8-002e-002700b3004c.png",
        "timestamp": 1599950430875,
        "duration": 625
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f300b9-005d-0059-004d-007600a2000b.png",
        "timestamp": 1599950431874,
        "duration": 647
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b70032-000b-0048-0028-000c001100a2.png",
        "timestamp": 1599950432892,
        "duration": 469
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001500de-0084-0031-0008-006d002a00ef.png",
        "timestamp": 1599950433725,
        "duration": 654
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc004c-00cc-0035-003d-00af00bf0096.png",
        "timestamp": 1599950434754,
        "duration": 600
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7059,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00240087-005f-00d9-0008-00df00a200df.png",
        "timestamp": 1599950435741,
        "duration": 339
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f50079-001e-0006-0055-009900ca000b.png",
        "timestamp": 1599950510427,
        "duration": 2996
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0052003c-006a-00d1-0042-005d00da0078.png",
        "timestamp": 1599950513846,
        "duration": 485
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00b400bf-0060-00b5-0023-00f300ec00c6.png",
        "timestamp": 1599950514705,
        "duration": 852
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f300c1-0073-003b-001f-00a4006800b9.png",
        "timestamp": 1599950515958,
        "duration": 481
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003f008a-004a-0066-0021-003b0008006a.png",
        "timestamp": 1599950516841,
        "duration": 347
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "timestamp": 1599950517595,
        "duration": 667
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, strong.mainHeading)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as getText] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.verifyHeaderText (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:12:23)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:12:44)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"All elements displayed on Customer's Login Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:11:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518284,
        "duration": 10
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(css selector, option.ng-binding)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run it(\"All Customer names present in the dropdown\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:17:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518307,
        "duration": 6
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:23:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Hermoine Granger can log in\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:22:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518325,
        "duration": 11
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:32:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Harry Potter can log in\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:31:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518348,
        "duration": 8
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:41:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Ron Weasly can log in\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:40:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518380,
        "duration": 7
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:50:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Albus Dumbledore can log in\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:49:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518401,
        "duration": 9
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:59:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Neville Longbottom can log in\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:58:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518431,
        "duration": 7
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.model(\"custId\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.choseUser (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:25:66)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:68:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Customer can log in and log out successfully\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:67:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518452,
        "duration": 14
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)",
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)",
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Protractor.waitForAngular() - Locator: by.buttonText(\"Home\")\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (/usr/local/lib/node_modules/protractor/built/browser.js:423:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:454:33\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)Error\n    at ElementArrayFinder.applyAction_ (/usr/local/lib/node_modules/protractor/built/element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:91:29)\n    at ElementFinder.<computed> [as click] (/usr/local/lib/node_modules/protractor/built/element.js:831:22)\n    at CustomerLoginPage.returnToLandingPage (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Pages/CustomerLoginPage.js:20:17)\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:76:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\nFrom: Task: Run it(\"Customer Login process can return to the Landing Page\") in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at Function.next.fail (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4274:9)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:75:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518479,
        "duration": 6
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7191,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Failed: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)"
        ],
        "trace": [
            "UnexpectedAlertOpenError: unexpected alert open: {Alert text : Customer added successfully with customer id :6}\n  (Session info: chrome=85.0.4183.102)\n  (Driver info: chromedriver=85.0.4183.87 (cd6713ebf92fa1cacc0f1a598df280093af0c5d7-refs/branch-heads/4183@{#1689}),platform=Mac OS X 10.15.6 x86_64)\n    at Object.checkLegacyResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/error.js:553:13)\n    at parseHttpResponse (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:509:13)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at Driver.schedule (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:807:17)\n    at Navigation.to (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:1133:25)\n    at Driver.get (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/webdriver.js:988:28)\n    at /usr/local/lib/node_modules/protractor/built/browser.js:673:32\n    at ManagedPromise.invokeCallback_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1376:14)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2927:27\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:94:19)\n    at attempt (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4297:26)\n    at QueueRunner.run (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4217:20)\n    at runNext (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4257:20)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4264:13\n    at /usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4172:9\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:64:48\n    at ControlFlow.emit (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/events.js:62:21)\n    at ControlFlow.shutdown_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2674:10)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:6:5)\n    at addSpecsToSuite (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1107:25)\n    at Env.describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:1074:7)\n    at describe (/usr/local/lib/node_modules/protractor/node_modules/jasmine-core/lib/jasmine-core/jasmine.js:4399:18)\n    at Object.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1201:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1221:10)\n    at Module.load (internal/modules/cjs/loader.js:1050:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:938:14)"
        ],
        "browserLogs": [],
        "timestamp": 1599950518500,
        "duration": 3
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c80050-005c-0089-00ec-00a6009300e2.png",
        "timestamp": 1599950626237,
        "duration": 2736
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00910044-00f8-00ba-008e-00e900000031.png",
        "timestamp": 1599950629445,
        "duration": 499
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:39:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00be0035-0057-00cc-0037-003800a700d6.png",
        "timestamp": 1599950630327,
        "duration": 1240
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ab0056-004b-000a-0015-009600570090.png",
        "timestamp": 1599950631978,
        "duration": 304
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00580035-0059-004e-004d-0096002f006a.png",
        "timestamp": 1599950632677,
        "duration": 519
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cb00c3-0087-0076-00cf-002f00ac006b.png",
        "timestamp": 1599950633589,
        "duration": 874
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003800d7-00f9-0082-0047-002a00a300a8.png",
        "timestamp": 1599950634952,
        "duration": 1238
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected 6 to be 5."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:19:33)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "006400bd-0038-00cf-00b6-00a900ab0065.png",
        "timestamp": 1599950636555,
        "duration": 391
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e00df-0010-00ff-00e0-00b5003c00c5.png",
        "timestamp": 1599950637325,
        "duration": 816
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009200e8-003b-00a7-005c-0032001f0037.png",
        "timestamp": 1599950638511,
        "duration": 666
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00cc00e8-0005-00e1-000c-00c70064001c.png",
        "timestamp": 1599950639544,
        "duration": 652
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b00b8-00a8-00cc-00d6-002f00e000b4.png",
        "timestamp": 1599950640566,
        "duration": 659
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00270047-0058-0019-0094-005700210001.png",
        "timestamp": 1599950641598,
        "duration": 763
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected 6 to be 5."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:72:33)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "009d0022-0059-006f-00c1-002b001600a4.png",
        "timestamp": 1599950642729,
        "duration": 634
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee00a0-0070-00b6-00c4-009900d200fa.png",
        "timestamp": 1599950643793,
        "duration": 554
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7337,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00300000-003d-00ef-00bd-00b6000f00d1.png",
        "timestamp": 1599950644707,
        "duration": 372
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100c6-0092-007f-004a-007a00ab00a7.png",
        "timestamp": 1599950764271,
        "duration": 2830
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e800cb-00ed-00de-00a3-00df00e60036.png",
        "timestamp": 1599950767611,
        "duration": 676
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true.",
            "Expected Function to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:35:37)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:36:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:37:36)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/BankManager_Functionality.spec.js:38:42)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "008c00c2-0009-0064-005e-00de004b00c8.png",
        "timestamp": 1599950768661,
        "duration": 1259
    },
    {
        "description": "Bank Account Manager can access xxxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00410087-0020-0068-0052-00bc00190073.png",
        "timestamp": 1599950770321,
        "duration": 328
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001500d7-00ef-00f6-0007-00ab008b00de.png",
        "timestamp": 1599950771049,
        "duration": 345
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009100fa-008f-000d-0043-00ae0077002e.png",
        "timestamp": 1599950771781,
        "duration": 914
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c300f4-00f8-00ee-00de-008a00c1001c.png",
        "timestamp": 1599950773156,
        "duration": 1538
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected 6 to be 5."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:19:33)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "005a00a0-0021-00a8-00ea-00ab009c00ed.png",
        "timestamp": 1599950775070,
        "duration": 540
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00780090-0093-00c8-0008-00aa00a900cb.png",
        "timestamp": 1599950775998,
        "duration": 947
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0056008a-0074-0081-0020-004f00ec00ec.png",
        "timestamp": 1599950777323,
        "duration": 563
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005100cc-0090-0084-00ab-00c6003b00d5.png",
        "timestamp": 1599950778268,
        "duration": 672
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00070044-00a5-00ad-0060-001300d2001d.png",
        "timestamp": 1599950779301,
        "duration": 660
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "002100cd-0091-006a-00ac-00e8008c0052.png",
        "timestamp": 1599950780339,
        "duration": 658
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": false,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": [
            "Expected 6 to be 5."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (/Users/albert.woloszyn/Projects/HighCode/JavaScript/ProtExam/Tests/Customer_LoginFunctionality.spec.js:72:33)\n    at /usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:112:25\n    at new ManagedPromise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:1077:7)\n    at ControlFlow.promise (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2505:12)\n    at schedulerExecute (/usr/local/lib/node_modules/protractor/node_modules/jasminewd2/index.js:95:18)\n    at TaskQueue.execute_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3084:14)\n    at TaskQueue.executeNext_ (/usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:3067:27)\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:2974:25\n    at /usr/local/lib/node_modules/protractor/node_modules/selenium-webdriver/lib/promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00920020-004c-000f-003f-00b700a60088.png",
        "timestamp": 1599950781371,
        "duration": 655
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a4000d-00c5-00da-0013-00ad00b90035.png",
        "timestamp": 1599950782395,
        "duration": 579
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 7581,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00d3005c-0048-0087-00b4-00d6003400e9.png",
        "timestamp": 1599950783332,
        "duration": 512
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
