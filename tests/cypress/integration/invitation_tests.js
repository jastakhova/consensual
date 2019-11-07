const faker = require('faker');

describe('invitation', () => {
    const randomEmail1 = faker.internet.email();
    const password1 = faker.internet.password();
    const name1 = faker.name.findName();

    before(() => {
      cy.get('input[name="at-field-email"]').type(randomEmail1);
      cy.get('input[name="at-field-password"]').type(password1);
      cy.get('input[name="at-field-name"]').type(name1);

      cy.get('button[type=submit]').click();

      cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');
    });

    beforeEach(() => {
        cy.visit('https://dev.consensu.al');
    });
});