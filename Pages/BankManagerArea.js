var BankManagerArea = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));
    var addCust = element(by.buttonText('Add Customer'));
    var openAcc = element(by.buttonText('Open Account'));
    var customers = element(by.buttonText('Customers'));

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.verifyElements = function () {
        return homeBtn.getText();
        return addCust.getText();
        return openAcc.getText();
        return customers.getText();
    };
    
};
module.exports = new BankManagerArea();