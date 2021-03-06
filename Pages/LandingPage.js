require('../Pages/CustomerLoginPage.js');
require('../Pages/BankManagerLogin.js');
var LandingPage = function () {
    
    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));
    var custLoginBtn = element(by.css('div.borderM.box.padT20 > div:nth-child(1) > button'));
    var BankManagerLoginBtn = element(by.css('div:nth-child(3) > button'));


    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.verifyHomeBtn = function () {
        return homeBtn.isDisplayed();
    };

    this.accessCustomerLogin = function () {
        custLoginBtn.click();
        return require('./CustomerLoginPage.js');
    };

    this.accessBankManagerLogin = function () {
        BankManagerLoginBtn.click();
        return require('./BankManagerLogin.js');
    };

};
module.exports = new LandingPage();