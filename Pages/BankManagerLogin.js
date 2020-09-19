var BankManagerLogin = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));
    var addCust = element(by.buttonText('Add Customer'));
    var openAcc = element(by.buttonText('Open Account'));
    var customersBtn = element(by.buttonText('Customers'));
    

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.accessAddCustomer = function () {
        addCust.click();
        return require('./AddCustomer');
    };

    this.accessOpenAccount = function () {
        openAcc.click();
        return require('./OpenAccount');
    };

    this.accessCustomers = function () {
        customersBtn.click();
        return require('./Customers');
    };

    this.accessLandingPage = function () {
        homeBtn.click();
        return require('./LandingPage');
    };
};
module.exports = new BankManagerLogin();