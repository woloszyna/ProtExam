var OpenAccount = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.accessLandingPage = function () {
        homeBtn.click();
        return require('./LandingPage');
    };

    this.accessAddCustomer = function () {
        addCust.click();
        return require('./AddCustomer');
    };

    this.accessCustomers = function () {
        customersBtn.click();
        return require('./Customers');
    };
    
};
module.exports = new OpenAccount();