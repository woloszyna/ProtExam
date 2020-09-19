var Customers = function () {

    var header = element(by.css('strong.mainHeading'));
    var homeBtn = element(by.buttonText('Home'));
    var searchBar = element(by.model('searchCustomer'));
    var deleteBtnCount = element.all(by.buttonText('Delete'));



    this.verifyHeaderText = function () {
        return header.getText();
    };

    this.countCustomers = function () {
        return deleteBtnCount.count();
    };

    this.searchForCreated = function () {
        searchBar.sendKeys('PsT1234x');
    };



    this.accessLandingPage = function () {
        homeBtn.click();
        return require('./LandingPage');
    };


    
};
module.exports = new Customers();