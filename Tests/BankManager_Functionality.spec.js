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

    it('Bank Manager can revert back to the Landing Page from Login Page', function () {
        BankManagerLogin.accessLandingPage();
        var custLoginBtn = element(by.css('div.borderM.box.padT20 > div:nth-child(1) > button'));
        expect(custLoginBtn.isPresent()).toBe(true);
    });
    
    it('Bank Account Manager can access \'Add Customer\' page', function () {      
        var AddCustomer = BankManagerLogin.accessAddCustomer();
        var headerText = AddCustomer.verifyHeaderText();
        expect(headerText).toBe('XYZ Bank');
    });
    

    it('All elements are displayed on the \'Add Customer\' Page', function () {
        BankManagerLogin.accessAddCustomer();
        var firstName = element(by.model('fName'));
        var lastName = element(by.model('lName'));
        var postCode = element(by.model('postCd'));
        var addCustomerBtn = element(by.css('button.btn-default'));
        expect(firstName.isPresent()).toBe(true);
        expect(lastName.isPresent()).toBe(true);
        expect(postCode.isPresent()).toBe(true);
        expect(addCustomerBtn.isPresent()).toBe(true);
    });
    
    it('Bank Manager can revert back to the Landing Page from \'Add Customer\' Page', function () {
        var addCustomer = BankManagerLogin.accessAddCustomer();
        var LandingPage = addCustomer.accessLandingPage();
        var custLoginBtn = element(by.css('div.borderM.box.padT20 > div:nth-child(1) > button'));
        expect(custLoginBtn.isPresent()).toBe(true);
    });
    
    it('Bank Account Manager can access \'Open Account\' page', function () {
        BankManagerLogin.accessOpenAccount();
        var addCustomerBtn = element(by.buttonText('Add Customer'));
        var openAccountBtn = element(by.buttonText('Open Account'));
        var customersBtn = element(by.buttonText('Customers'));
        var custDropdown = element(by.model('custId'));
        var currencyDropdown = element(by.model('currency'));
        var processBtn = element(by.buttonText('Process'));
        expect(addCustomerBtn.isPresent()).toBe(true);
        expect(openAccountBtn.isPresent()).toBe(true);
        expect(customersBtn.isPresent()).toBe(true);
        expect(custDropdown.isPresent()).toBe(true);
        expect(currencyDropdown.isPresent()).toBe(true);
        expect(processBtn.isPresent()).toBe(true);        
    });

    it('Bank Account Manager can access \'Customers\' page', function () {
        BankManagerLogin.accessCustomers();
        var addCustomerBtn = element(by.buttonText('Add Customer'));
        var openAccountBtn = element(by.buttonText('Open Account'));
        var customersBtn = element(by.buttonText('Customers'));
        var searchBar = element(by.model('searchCustomer'));
        var customersTable = element(by.css('.table'));
        expect(addCustomerBtn.isPresent()).toBe(true);
        expect(openAccountBtn.isPresent()).toBe(true);
        expect(customersBtn.isPresent()).toBe(true);
        expect(searchBar.isPresent()).toBe(true);
        expect(customersTable.isPresent()).toBe(true);
    });


    it('Customer can be successfully created', function () {
        var AddCustomer = BankManagerLogin.accessAddCustomer();
        AddCustomer.addCustomer();
        //TODO: #2 Go to Customer's and verify that customer is created
        var Customers = AddCustomer.accessCustomers();
        var custCount = Customers.countCustomers();
        expect(custCount).toBe(6);
        Customers.searchForCreated();
        
    });

    afterAll(function () {
        //TODO: #1 Access customer that was created and delete them
    });
});