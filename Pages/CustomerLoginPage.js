require('../Pages/LandingPage.js');
require('../Pages/CustomerPage.js');

var CustomerLoginPage = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.css('.btn home'));
    var yourNameDropdown = element.all(by.css('option.ng-binding')); 
    var loginBtn = element(by.css('.btn-default'));

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.countDropdownOptions = function () {
        return yourNameDropdown.count();
    };

    this.returnToLandingPage = function () {
        homeBtn.click();
        return require('./LandingPage.js');
    };

    this.choseUser = function (index) {
        element(by.model('custId')).$('[value="' + index + '"]').click();
    };

    this.clickOnLoginBtn = function () {
        loginBtn.click();
        return require('./CustomerPage.js');
    };    
};
module.exports = new CustomerLoginPage();