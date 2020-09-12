var LandingPage = require("../Pages/LandingPage");
var BankManagerLogin = require("../Pages/BankManagerLogin");

describe('Bank Manager\'s Login process', function () {

    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
        LandingPage.accessBankManagerLogin();
    });

    it('Header displayed on Bank Manager\'s Login Page', function () {
        var headerText = BankManagerLogin.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
    });

    it('All elements are displayed on the Bank Manager\'s Login Page', function () {
        var homeBtn = element(by.buttonText('Home'));
        var addCust = element(by.buttonText('Add Customer'));
        var openAcc = element(by.buttonText('Open Account'));
        var customers = element(by.buttonText('Customers'));
        expect(homeBtn.isPresent()).toBe(true);
        expect(addCust.isPresent()).toBe(true);
        expect(openAcc.isPresent()).toBe(true);
        expect(customers.isPresent()).toBe(true);
    });   
});