

var CustomerPage = function () {

    var header = element(by.css('strong.mainHeading'));
    var name = element(by.css('span.ng-binding'));
    var logOutBtn = element(by.buttonText('Logout'));
    var homeBtn = element(by.buttonText('Home'));

    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.verifyCorrectUsr = function () {
        return name.getText();
    };
    
    this.logOut = function () {
        logOutBtn.click();
        return require('../Pages/CustomerLoginPage');
    }; 
};
module.exports = new CustomerPage();