describe('sign-up', () => {
    beforeEach(() => {
        cy.visit('https://dev.consensu.al');
    });

    it('should create and log the new user', () => {
        cy.contains('Try with a Demo Account').click();

        cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

        cy.window().then(win => {
            // this allows accessing the window object within the browser
            const user = win.Meteor.user();
            expect(user).to.exist;
            expect(user.profile.name).to.equal('Demo account');
        });
    });
});