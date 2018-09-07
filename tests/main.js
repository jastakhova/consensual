import assert from "assert";

import '../imports/api/tasks.test.js';

if (Meteor.isClient) {
	import '../imports/components/todosList/todosList.test.js';
}

describe("consensual", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "consensual");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });
  }
});
