var AddCustomer = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));
    var customersBtn = element(by.css('div.center > button:nth-child(3)'));
    var firstName = element(by.model('fName'));
    var lastName = element(by.model('lName'));
    var postCode = element(by.model('postCd'));
    var addCustomerBtn = element(by.css('button.btn-default'));

    var currentdate = new Date();
    var timestamp = currentdate.getDay()
        + currentdate.getMonth()
        + currentdate.getFullYear()
        + currentdate.getHours()
        + currentdate.getMinutes()
        + currentdate.getSeconds();

    this.verifyHeaderText = function () {
        return header.getText();
    }

    this.accessOpenAccount = function () {
        openAcc.click();
        return require('./OpenAccount');
    };

    this.accessCustomers = function () {
        customersBtn.click();
        return require('./Customers');
    };

    this.addCustomer = function () {
        firstName.sendKeys('First_' + timestamp);
        lastName.sendKeys('Second_' + timestamp);
        postCode.sendKeys('PsT1234x');
        addCustomerBtn.click();
        var alert = browser.switchTo().alert();
        alert.accept();
    };

    this.accessLandingPage = function () {
        homeBtn.click();
        return require('./LandingPage');
    };

}
module.exports = new AddCustomer();