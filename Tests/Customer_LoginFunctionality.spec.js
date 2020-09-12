describe('Customer\'s Login process', function () {

    var LandingPage = require('../Pages/LandingPage');
    var CustomerLoginPage = require('../Pages/CustomerLoginPage');

    beforeEach(function () {
        browser.get('https://www.globalsqa.com/angularJs-protractor/BankingProject/#/login');
        LandingPage.accessCustomerLogin();
    });

    it('All elements displayed on Customer\'s Login Page', function () {
        var headerText = CustomerLoginPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        //TODO: #3 Check if dropdown is present
    });

    it('All Customer names present in the dropdown', function () {
        var dropdownOptions = CustomerLoginPage.countDropdownOptions();
        expect(dropdownOptions).toBe(5);
    });

    it('Hermoine Granger can log in', function () {
        CustomerLoginPage.choseUser(1);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Hermoine Granger');
    });

    it('Harry Potter can log in', function () {
        CustomerLoginPage.choseUser(2);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Harry Potter');
    });

    it('Ron Weasly can log in', function () {
        CustomerLoginPage.choseUser(3);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Ron Weasly');
    });

    it('Albus Dumbledore can log in', function () {
        CustomerLoginPage.choseUser(4);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Albus Dumbledore');
    });
    
    it('Neville Longbottom can log in', function () {
        CustomerLoginPage.choseUser(5);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var headerText = customerPage.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var user = customerPage.verifyCorrectUsr();
        expect(user).toBe('Neville Longbottom');
    });

    it('Customer can log in and log out successfully', function () {
        CustomerLoginPage.choseUser(1);
        var customerPage = CustomerLoginPage.clickOnLoginBtn();
        var loginPage = customerPage.logOut();
        var dropdownOptions = loginPage.countDropdownOptions();
        expect(dropdownOptions).toBe(5); 
    });
    
    it('Customer Login process can return to the Landing Page', function () {
        CustomerLoginPage.returnToLandingPage();
        expect(element(by.css('div.borderM.box.padT20 > div:nth-child(1) > button')).isPresent()).toBeTruthy(); //Is there any way to call this element from LandingPage.custLoginBtn?
        expect(element(by.css('div:nth-child(3) > button')).isPresent()).toBeTruthy(); //Is there any way to call this element from LandingPage.BankManagerLoginBtn?
    });

    it('Bank Account Manager can access Bank Manager Login area', function () {
        
    });
});