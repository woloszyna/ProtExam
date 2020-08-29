require('../Pages/CustomerLoginPage.js');
require('../Pages/BankManagerArea.js');
var LandingPage = function () {
    
    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.css('.btn home'));
    var custLoginBtn = element(by.css('div.borderM.box.padT20 > div:nth-child(1) > button'));
    var BankManagerLoginBtn = element(by.css('div:nth-child(3) > button'));


    this.headerText = function () {
        return header.getText();
    };

    this.accessCustomerLogin = function () {
        custLoginBtn.click();
        return require('.CustomerLoginPage.js');
    };

    this.accessBankManagerArea = function () {
        BankManagerLoginBtn.click();
        return require('./BankManagerArea.js');
    };

};
module.exports = new LandingPage();