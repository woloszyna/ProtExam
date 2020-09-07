describe('Customer\'s Login Page verification', function () {

    var LandingPage = require('../Pages/LandingPage');
    var CustomerLoginPage = require('../Pages/CustomerLoginPage');

    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
        LandingPage.accessCustomerLogin();
    });

    it('Displays header on Customer\'s Login Page', function () {
        var headerText = CustomerLoginPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
    });

    it('Shows all login options in the dropdown', function () {
        var dropdownOptions = CustomerLoginPage.countDropdownOptions();
        expect(dropdownOptions).toBe(5);
        CustomerLoginPage.dropdown.click();

    });

    it('can login as Hermoine Granger', function () {
        CustomerLoginPage.choseUser(1);
        //browser.wait(CustomerLoginPage.loginBtn).isPresent();//verify if that works
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Hermoine Granger');
    });

    it('can login as Harry Potter', function () {
        CustomerLoginPage.choseUser(2);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Harry Potter');
    });

    it('can login as Ron Weasly', function () {
        CustomerLoginPage.choseUser(3);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Ron Weasly');
    });

    it('can login as Albus Dumbledore', function () {
        CustomerLoginPage.choseUser(4);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Albus Dumbledore');
    });
    
    it('can login as Neville Longbottom', function () {
        CustomerLoginPage.choseUser(5);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Neville Longbottom');
    });

    it('can log in and log out successfully', function () {
        CustomerLoginPage.choseUser(1);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var loginPage = customerPage.logOut();
        var dropdownOptions = CustomerLoginPage.countDropdownOptions();
        expect(dropdownOptions).toBe(5); 
    });
});