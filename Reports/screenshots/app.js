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
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc00bd-001e-00fd-00ac-001400f20079.png",
        "timestamp": 1601109396593,
        "duration": 3209
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007d00aa-00ef-0043-0099-007b00de00a0.png",
        "timestamp": 1601109400288,
        "duration": 722
    },
    {
        "description": "Header displayed on Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00d50036-006f-0067-006b-009b00530063.png",
        "timestamp": 1601109398117,
        "duration": 3683
    },
    {
        "description": "All elements are displayed on the Bank Manager's Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fc005d-00ee-0024-003a-006000710030.png",
        "timestamp": 1601109401992,
        "duration": 590
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a70013-005c-0065-0031-00170068003f.png",
        "timestamp": 1601109401421,
        "duration": 925
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from Login Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009b006f-0046-00f0-006a-00e300a90065.png",
        "timestamp": 1601109402782,
        "duration": 700
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0086003c-00f1-0062-0014-001700080003.png",
        "timestamp": 1601109403699,
        "duration": 577
    },
    {
        "description": "Bank Account Manager can access 'Add Customer' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00850082-00ed-006b-00ad-004300db0097.png",
        "timestamp": 1601109402883,
        "duration": 1623
    },
    {
        "description": "All elements are displayed on the 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c2006e-007e-0086-0095-009a000f008f.png",
        "timestamp": 1601109404994,
        "duration": 450
    },
    {
        "description": "All elements are displayed on the 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003700bc-006e-00e6-00c9-001b00580079.png",
        "timestamp": 1601109404545,
        "duration": 1648
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003600c8-003e-008e-0014-00620084006f.png",
        "timestamp": 1601109405934,
        "duration": 926
    },
    {
        "description": "Bank Manager can revert back to the Landing Page from 'Add Customer' Page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a006d-00fc-001a-00c0-009100da0063.png",
        "timestamp": 1601109406362,
        "duration": 1388
    },
    {
        "description": "Bank Account Manager can access 'Open Account' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004d002a-00d1-0050-0044-00700081008b.png",
        "timestamp": 1601109407226,
        "duration": 1143
    },
    {
        "description": "Bank Account Manager can access 'Open Account' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f00ff-00d6-004b-0098-00bb00650025.png",
        "timestamp": 1601109407911,
        "duration": 1211
    },
    {
        "description": "Bank Account Manager can access 'Customers' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00f6004e-0089-00c3-00e9-00c2001100df.png",
        "timestamp": 1601109408770,
        "duration": 1772
    },
    {
        "description": "Bank Account Manager can access 'Customers' page|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003e0071-00cc-0056-0070-00d1006b00fe.png",
        "timestamp": 1601109409300,
        "duration": 2151
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005400b1-008a-002f-006e-00490012001e.png",
        "timestamp": 1601109411646,
        "duration": 841
    },
    {
        "description": "Customer can be successfully created|Bank Manager's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001a0047-0001-00e1-0033-00b1009f0068.png",
        "timestamp": 1601109410968,
        "duration": 1831
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007c008f-0001-0038-0032-0093008100c3.png",
        "timestamp": 1601109413479,
        "duration": 668
    },
    {
        "description": "All elements displayed on Customer's Login Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "003b002d-008e-0045-0061-00a9002d006c.png",
        "timestamp": 1601109412782,
        "duration": 1808
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001b00b8-0040-0024-0057-00ba002600f8.png",
        "timestamp": 1601109414515,
        "duration": 719
    },
    {
        "description": "All Customer names present in the dropdown|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001900b9-0042-005d-0038-00b600ca00d3.png",
        "timestamp": 1601109414831,
        "duration": 1581
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "000d0077-0078-0084-000e-0016007000c4.png",
        "timestamp": 1601109415627,
        "duration": 1176
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008300ca-0021-00dc-00f3-00ed006d00e9.png",
        "timestamp": 1601109417206,
        "duration": 727
    },
    {
        "description": "Hermoine Granger can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00890088-0005-003a-002b-00c5002b0068.png",
        "timestamp": 1601109416569,
        "duration": 2167
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ea0031-0020-00e8-00c7-00c30050002a.png",
        "timestamp": 1601109418349,
        "duration": 642
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0094002f-0008-00a5-005d-00d700aa00d7.png",
        "timestamp": 1601109419423,
        "duration": 830
    },
    {
        "description": "Harry Potter can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b5008b-00db-001c-0068-0049006000f3.png",
        "timestamp": 1601109418943,
        "duration": 1632
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0025006c-0091-00d6-004d-00a200590062.png",
        "timestamp": 1601109420715,
        "duration": 862
    },
    {
        "description": "Ron Weasly can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ee00e7-009c-0024-0033-0076003800db.png",
        "timestamp": 1601109420735,
        "duration": 1764
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a10050-00bc-0060-007f-001b006a009c.png",
        "timestamp": 1601109421958,
        "duration": 1029
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007000c7-00ff-00a1-0097-00ec004b0059.png",
        "timestamp": 1601109423357,
        "duration": 365
    },
    {
        "description": "Albus Dumbledore can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0016007f-005b-0052-007c-00d0008800f5.png",
        "timestamp": 1601109422655,
        "duration": 1681
    },
    {
        "description": "Neville Longbottom can log in|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00430012-00cc-005b-00df-00e4009c00de.png",
        "timestamp": 1601109424503,
        "duration": 569
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac os x",
        "sessionId": "cf4f274aa6a6635bee712ae40b295369",
        "instanceId": 7954,
        "browser": {
            "name": "chrome",
            "version": "85.0.4183.121"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005b00e9-0040-0092-00b8-0064004f005f.png",
        "timestamp": 1601109424121,
        "duration": 766
    },
    {
        "description": "Customer can log in and log out successfully|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fd00fa-0097-00ed-0013-001800f4003d.png",
        "timestamp": 1601109425233,
        "duration": 1636
    },
    {
        "description": "Customer Login process can return to the Landing Page|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b900b5-0072-007d-00ba-002c00ea002e.png",
        "timestamp": 1601109426986,
        "duration": 1294
    },
    {
        "description": "Bank Account Manager can access Bank Manager Login area|Customer's Login process",
        "passed": true,
        "pending": false,
        "os": "mac",
        "sessionId": "38cbeb9b-5b93-fb43-92d9-ee21fed9064f",
        "instanceId": 7953,
        "browser": {
            "name": "firefox",
            "version": "79.0"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a3002a-0013-000b-0086-00d200d700c4.png",
        "timestamp": 1601109428399,
        "duration": 1186
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
