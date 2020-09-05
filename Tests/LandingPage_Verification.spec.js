const { clickOnLoginBtn } = require('../Pages/CustomerLoginPage');

describe('It should be possible to access customer\'s area', function () {
    
    var LandingPage = require('../Pages/LandingPage');    
    
    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
    });

    it('Displays header on Landing Page', function () {
        var headerText = LandingPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
    }); 
    
});