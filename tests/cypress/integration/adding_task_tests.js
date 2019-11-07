const faker = require('faker');

describe('adding_task', () => {

    const randomEmail1 = faker.internet.email();
    const password1 = faker.internet.password();
    const name1 = faker.name.findName();

    before(() => {
      cy.visit('https://dev.consensu.al');
      cy.get('input[name="at-field-email"]').type(randomEmail1);
      cy.get('input[name="at-field-password"]').type(password1);
      cy.get('input[name="at-field-name"]').type(name1);

      cy.get('button[type=submit]').click();

      cy.url().should('eq', 'https://dev.consensu.al/#!/tab/todo');
    });

    beforeEach(() => {
    });

    it('should be able to add a self task', () => {
        cy.get("input.hideOnTask").click();

        const taskName = "ST " + name1;
        cy.get("textarea[name='newTask']").type(taskName);

        cy.get("span.circle").click();
        cy.get("input[name='newReceiver']").should('have.value', name1);

        cy.get("button.pull-right").should('have.attr', 'disabled', 'disabled');
        cy.get("div.tomorrow").should('contain', 'tomorrow');
        cy.get("div.tomorrow").click();
        cy.get("button.pull-right").click();
        cy.wait(300);
        cy.get("a.taskLink").contains(taskName.substr(0, 10)).should('exist');
    });
});