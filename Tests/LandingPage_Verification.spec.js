describe('It should be possible to access customer\'s area', function () {
    
    var LandingPage = require('../Pages/LandingPage');    
    
    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
    });

    it('Displays header on Landing Page', function () {
        var headerText = LandingPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');

    });

    it('Displays header on Customer Login Page', function () {
        var customerLoginPage = LandingPage.accessCustomerLogin();
        var headerText = customerLoginPage.headerText();
        expect(headerText).toBe('XYZ Bank');        
    });

    it('Shows all login options in the dropdown', function () {
        var customerLoginPage = LandingPage.accessCustomerLogin();
        var dropdownOptions = customerLoginPage.countDropdownOptions();
        expect(dropdownOptions).toBe(5);
        
    });
    
    it('xxx', function () {
        
    });
    
    
});