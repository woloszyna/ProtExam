var BankManagerLogin = function () {

    var header = element(by.css('strong.mainHeading'));
    var addCust = element(by.buttonText('Add Customer'));
    var openAcc = element(by.buttonText('Open Account'));
    var customers = element(by.buttonText('Customers'));

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.accessAddCustomer = function () {
        addCust.click();
        return require('./AddCustomer.js');
    };

    this.accessOpenAccount = function () {
        openAcc.click();
        return require('./OpenAccount');
    };

    this.accessCustomers = function () {
        customers.click();
        return require('./Customers');
    };
    
};
module.exports = new BankManagerLogin();