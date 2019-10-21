const faker = require('faker');

describe('sign-up', () => {
    before(() => {
    });

    beforeEach(() => {
        cy.visit('https://dev.consensu.al');
    });

    it('should create and log the demo user', () => {
        cy.contains('Try with a Demo Account').click();

        cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

        cy.window().then(win => {
            // this allows accessing the window object within the browser
            const user = win.Meteor.user();
            expect(user).to.exist;
            expect(user.profile.name).to.equal('Demo account');
        });
    });

    it('should create a new user and verify email via new window', () => {
        const randomEmail = faker.internet.email();
        const password = faker.internet.password();
        const name = faker.name.findName();

        cy.get('input[name="at-field-email"]').type(randomEmail);
        cy.get('input[name="at-field-password"]').type(password);
        cy.get('input[name="at-field-name"]').type(name);

        cy.get('button[type=submit]').click();

        cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

        cy.window().then(win => {
            // this allows accessing the window object within the browser
            const user = win.Meteor.user();
            expect(user).to.exist;
            expect(user.profile.name).to.equal(name);
        });

        cy.exec('mongo mongodb://localhost:3001/meteor --quiet --eval "db.users.find({\\\"emails.address\\\":  \\\"' + randomEmail.toLowerCase() + '\\\", \\\"emails.verified\\\": false}, {\\\"services.email.verificationTokens.token\\\": 1})"')
          .then((obj) => {
              cy.log(JSON.parse(obj.stdout));

              cy.get('a.logout').click();
              cy.url().should('eq', 'https://dev.consensu.al/#!/login');

              cy.wait(1000);

              cy.window().then(win => {
                          // this allows accessing the window object within the browser
                  const user = win.Meteor.user();
                  expect(user).to.be.null;
              });

              cy.clearCookies()

              const confirmationUrl = 'https://dev.consensu.al/#/verify-email/' + JSON.parse(obj.stdout).services.email.verificationTokens[0].token;
              cy.visit(confirmationUrl);
              cy.contains('Dismiss').click();
              cy.wait(1000);
              cy.get('p.go-to-main-page').click();

              cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');
            });
    });
});