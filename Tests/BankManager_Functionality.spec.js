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
    
    it('Bank Account Manager can access \'Add Customer\' page', function () {      
        var AddCustomer = BankManagerLogin.accessAddCustomer();
        var headerText = AddCustomer.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
        var firstName = element(by.model('fName'));
        var lastName = element(by.model('lName'));
        var postCode = element(by.model('postCd'));
        var addCustomerBtn = element(by.css('button.btn-default'));
        expect(firstName.isPresent).toBe(true);
        expect(lastName.isPresent).toBe(true);
        expect(postCode.isPresent).toBe(true);
        expect(addCustomerBtn.isPresent).toBe(true); 
    });

    it('Bank Account Manager can access xxxx page', function () {
        
    });

    it('Bank Account Manager can access xxx page', function () {
        
    });


    it('Customer can be successfully created', function () {
        var AddCustomer = BankManagerLogin.accessAddCustomer();
        AddCustomer.addCustomer();
        //TODO: Go to Customer's and verify that customer is created
    });

    afterAll(function () {
        //TODO: Access customer that was created and delete them
    });
});