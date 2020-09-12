const LandingPage = require("../Pages/LandingPage");
const BankManagerArea = require("../Pages/BankManagerArea");

describe('Bank Manager\'s Login process', function () {
    


    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
        LandingPage.accessBankManagerArea();
    });

    it('Header displayed on Bank Manager\'s Login Page', function () {
        var headerText = BankManagerArea.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
    });

    it('All elements are displayed on the Bank Manager\'s Login Page', function () {
        var elements = BankManagerArea.verifyElements();
        expect(elements).toBe('Home');//TODO, this was supposed to check number of elements. Learn arrays!!!!
    });

});