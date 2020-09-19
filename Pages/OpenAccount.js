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
    
};
module.exports = new OpenAccount();