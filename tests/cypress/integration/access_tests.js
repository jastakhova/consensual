const faker = require('faker');

describe('access', () => {
    before(() => {
    });

    beforeEach(() => {
        cy.visit('https://dev.consensu.al');
    });

    it('should redirect to login when logging out from proposal page', () => {
        cy.contains('Try with a Demo Account').click();

        cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

        cy.window().then(win => {
            // this allows accessing the window object within the browser
            const user = win.Meteor.user();
            expect(user).to.exist;
            expect(user.profile.name).to.equal('Demo account');

            if (cy.get("a.taskLink").its('length') == 0 ) {
              // create a task
              assert.isTrue(false, 'not implemented but you should if you see this error. Good luck!')
            }

            cy.get("a.taskLink").first().invoke('attr', 'href')
              .then(href => {
                cy.visit(href);

                cy.url().should('eq', 'https://dev.consensu.al/' + href);
                cy.get('a.logout').click();

                cy.wait(1000);
                cy.url().should('eq', 'https://dev.consensu.al/#!/login');
              });
        });
    });

    it('should not allow people seeing agreements they do not participate in', () => {
        cy.contains('Try with a Demo Account').click();

        cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

        cy.window().then(win => {
            // this allows accessing the window object within the browser
            const user = win.Meteor.user();
            expect(user).to.exist;
            expect(user.profile.name).to.equal('Demo account');

            if (cy.get("a.taskLink").its('length') == 0 ) {
              // create a task
              assert.isTrue(false, 'not implemented but you should if you see this error. Good luck!')
            }

            if (cy.get("td:has(a.selfagreement-QA) ~ td > a.taskLink").its('length') == 0 ) {
              // create a self-task
              assert.isTrue(false, 'not implemented but you should if you see this error. Good luck!')
            }

            cy.get("td:has(a.selfagreement-QA) ~ td > a.taskLink").first().invoke('attr', 'href')
              .then(href => {
                cy.get('a.logout').click();

                cy.wait(1000);
                cy.url().should('eq', 'https://dev.consensu.al/#!/login');

                const randomEmail = faker.internet.email();
                const password = faker.internet.password();
                const name = faker.name.findName();

                cy.get('input[name="at-field-email"]').type(randomEmail);
                cy.get('input[name="at-field-password"]').type(password);
                cy.get('input[name="at-field-name"]').type(name);

                cy.get('button[type=submit]').click();

                cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');

                cy.visit(href);
                cy.wait(1000);

                cy.url().should('eq', 'https://dev.consensu.al/#!/tab/notfound');
              });
        });
    });
});