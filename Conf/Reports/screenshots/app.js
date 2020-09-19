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
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c400c4-009f-005e-0046-00f500ac002b.png",
        "timestamp": 1600526754807,
        "duration": 5074
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004e008f-00d1-004c-0078-00d1005b00bd.png",
        "timestamp": 1600526760220,
        "duration": 242
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0062000b-0018-003a-00b3-008700f60086.png",
        "timestamp": 1600526760800,
        "duration": 319
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001e00b5-0007-000c-00a0-00c9009700c0.png",
        "timestamp": 1600526761453,
        "duration": 964
    },
    {
        "description": "All elements are displayed on the 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00630084-00cb-002a-0006-0051006300ec.png",
        "timestamp": 1600526762777,
        "duration": 379
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000900ca-000c-00ed-00be-00f400f7002d.png",
        "timestamp": 1600526763463,
        "duration": 334
    },
    {
        "description": "Bank Account Manager can access xxxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00580060-0023-00ab-00b6-00700063003d.png",
        "timestamp": 1600526764126,
        "duration": 215
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000600c5-00d1-002e-00a2-00df000100a5.png",
        "timestamp": 1600526764660,
        "duration": 254
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00990028-002d-003e-00ec-002400e4002f.png",
        "timestamp": 1600526765235,
        "duration": 1427
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a20007-0026-0068-0069-007f00f10068.png",
        "timestamp": 1600526766984,
        "duration": 700
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005a00f7-00f3-00b6-00c3-006c003700a2.png",
        "timestamp": 1600526757065,
        "duration": 11001
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c900de-00a9-00aa-006f-00190049008d.png",
        "timestamp": 1600526767999,
        "duration": 254
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0058002a-0071-0000-002a-008c00c100b6.png",
        "timestamp": 1600526768177,
        "duration": 1335
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e00d6-0065-00dd-0003-00a5001400c7.png",
        "timestamp": 1600526768575,
        "duration": 773
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001d0095-001b-009a-00f2-001b00c300a7.png",
        "timestamp": 1600526769680,
        "duration": 229
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00720061-002a-0062-00cf-001e003d007e.png",
        "timestamp": 1600526769566,
        "duration": 1213
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a900ec-0098-00aa-00df-00b8001f0080.png",
        "timestamp": 1600526770232,
        "duration": 378
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f3008f-0052-00fb-00b6-000400ad00ea.png",
        "timestamp": 1600526770937,
        "duration": 345
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000e0014-00b6-00f5-0073-002a00d50019.png",
        "timestamp": 1600526771601,
        "duration": 346
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0003004c-0063-007b-0004-0003006800cd.png",
        "timestamp": 1600526772267,
        "duration": 362
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a9001b-004c-00dd-0075-00c800e400a6.png",
        "timestamp": 1600526770825,
        "duration": 2354
    },
    {
        "description": "All elements are displayed on the 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b7006b-0040-0025-0007-005300d800e5.png",
        "timestamp": 1600526773253,
        "duration": 337
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a00c3-00a7-00da-00ee-0011002400ee.png",
        "timestamp": 1600526772957,
        "duration": 405
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00110021-00a7-002e-0006-00ea00980020.png",
        "timestamp": 1600526773647,
        "duration": 305
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "Mac OS X",
        "instanceId": 62803,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.102"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009d009b-004e-00c7-0021-00c2001200d2.png",
        "timestamp": 1600526773673,
        "duration": 256
    },
    {
        "description": "Bank Account Manager can access xxxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009400a7-0096-00f3-00fb-009d00e70093.png",
        "timestamp": 1600526774001,
        "duration": 1148
    },
    {
        "description": "Bank Account Manager can access xxx page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c600fc-00a8-0074-0015-005c00e20030.png",
        "timestamp": 1600526775196,
        "duration": 1173
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00520016-0027-00f6-0017-006d00610031.png",
        "timestamp": 1600526776445,
        "duration": 1877
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ba0062-009d-00cf-00e3-002b007d00d9.png",
        "timestamp": 1600526778374,
        "duration": 2048
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00e1000e-005e-00be-003b-004e004d00c2.png",
        "timestamp": 1600526780473,
        "duration": 1443
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc00f9-0074-00fe-00a9-00cf008b00cc.png",
        "timestamp": 1600526781969,
        "duration": 2113
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c10081-00cb-0038-0019-00cb00400099.png",
        "timestamp": 1600526784132,
        "duration": 1491
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00bc0027-0071-00d7-00ca-007000630054.png",
        "timestamp": 1600526785674,
        "duration": 1473
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ed00f9-007b-0074-0078-00a500700031.png",
        "timestamp": 1600526787198,
        "duration": 1459
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00930059-0058-00f3-0078-001500f900c5.png",
        "timestamp": 1600526788707,
        "duration": 1528
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a2000c-009e-00dc-00f5-002e00e80096.png",
        "timestamp": 1600526790287,
        "duration": 1501
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb00fb-0064-0004-0061-0001002a0046.png",
        "timestamp": 1600526791834,
        "duration": 1236
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "instanceId": 62802,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b90070-0024-002f-00b8-00d30031004c.png",
        "timestamp": 1600526793118,
        "duration": 1198
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
