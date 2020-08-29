require('../Pages/LandingPage.js');
require('../Pages/CustomerPage.js');
var CustomerLoginPage = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.css('.btn home'));
    var yourNameDropdown = element.all(by.css('select#userSelect'));
    var loginBtn = element(by.css('button.btn btn-default'));

    this.headerText = function () {
        return header.getText();
    };

    this.countDropdownOptions = function () {
        yourNameDropdown.getText();
    };

    this.returnToLandingPage = function () {
        homeBtn.click();
        return require('.LandingPage.js');
    };

    this.choseUser = function (index) {
        element(by.model('custId')).$('value="' + index + '"').click();
    };

    this.clickOnLoginBut = function () {
        loginBtn.click();
        return require('.CustomerPage.js');
    };    
};
module.exports = new CustomerLoginPage();