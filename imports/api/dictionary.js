//////////////////////////// ACTIONS /////////////////////////////////////////////////////////
export const Actions = [
  "DECISION_YES", // 1A
  "DECISION_NO",  // 1B
  "DECISION_MAYBE", // 1C
  "EDIT", // 2
  "COMMENT", // 3
  "STATUS_CHANGE_DONE", // 4
  "STATUS_CHANGE_CANCEL", // 5
  "LOCK", // 6
  "COPY", // 7
  "REQUEST", // 8
  "REQUEST_APPROVE", //8A
  "REQUEST_DENY", // 8B
  "CANCEL_REQUEST", // 9
  "RECONSIDER", // 10
];

export const getAction = function(name) {
  if (Actions.indexOf(name) >= 0) {
    return name;
  }
  throw new Error("No action named " + name);
}

//////////////////////////// NOTICES /////////////////////////////////////////////////////////

export const Notices = [
  { // 0
    id: "NEW_PROPOSAL",
    text: "New proposal",
    type: "visit"
  },
  { // 1
    id: "PROPOSAL_APPROVED",
    text: "Proposal approved",
    type: "view"
  },
  { // 2
    id: "PROPOSAL_REJECTED",
    text: "Proposal rejected",
    type: "view"
  },
  { // 3
    id: "UNDER_CONSIDERATION",
    text: "Under consideration",
    type: "view"
  },
  { // 4
    id: "HAS_COMMENTS",
    text: "Has comments",
    type: "visit"
  },
  { // 5
    id: "HAS_UPDATES",
    text: "Has updates",
    type: "visit"
  },
  { // 6
    id: "LOCKED",
    text: "Locked",
    type: "view"
  },
  { // 7
    id: "CANCELLATION_REQUEST",
    text: "Cancellation request",
    type: "visit"
  },
  { // 8
    id: "CANCELLATION_APPROVAL",
    text: "Cancellation approval",
    type: "view"
  },
  { // 9
    id: "CANCELLATION_REQUEST_DENIED",
    text: "Cancellation request denied",
    type: "visit"
  },
  { // 10
    id: "CANCELLATION",
    text: "Cancellation",
    type: "visit"
  },
  {
    id: "NEEDS_DECISION",
    text: "Agreement is waiting for a decision",
    type: "visit"
  }
];

export const getNotice = function(code) {
  for (var i = 0; i < Notices.length; i++) {
    if (Notices[i].id === code) {
      return Notices[i];
    }
  }
  throw new Error("No notice named " + name);
}

//////////////////////////// STATUSES /////////////////////////////////////////////////////////

export const Statuses = [
  {
    id: "proposed",
    label: "Proposed"
  },
  {
    id: "agreed",
    label: "Agreed"
  },
  {
    id: "considered",
    label: "Under Consideration"
  },
  {
    id: "cancelled",
    label: "Cancelled"
  },
  {
    id: "done",
    label: "Done"
  }
];

export const getStatus = function(id) {
  var found = Statuses.filter(x => x.id === id);
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No status named " + id);
}

//////////////////////////// CONDITIONS /////////////////////////////////////////////////////////

export const Conditions = [
  {
    id: "grey",
    label: "no response"
  },
  {
    id: "green",
    label: "proposes",
    agreedLabel: "agrees"
  },
  {
    id: "yellow",
    label: "considers"
  },
  {
    id: "red",
    label: "opposes",
    agreedLabel: "rescinds"
  }
];

export const getCondition = function(id, task) {
  var found = Conditions.filter(x => x.id === id);
  if (found.length > 0) {
    if (task && task.wasAgreed && found[0].agreedLabel) {
      return {
        id: id,
        label: found[0].agreedLabel
      };
    }
    return found[0];
  }
  throw new Error("No condition named " + id);
}

//////////////////////////// STATES /////////////////////////////////////////////////////////
// One can always comment. Other actions are allowed depending on the state.

export const States = [
  {
    id: "PROPOSED",
    validation: function(task) {
      return task.status === getStatus("proposed").id;
    },
    actions: function(task, actorId) {
      if (task.author.id === actorId) {
        return [
          getAction("EDIT"),
          getAction("STATUS_CHANGE_DONE"),
          getAction("STATUS_CHANGE_CANCEL")
        ];
      }
      if (task.receiver.id === actorId) {
        return [
          getAction("DECISION_YES"),
          getAction("DECISION_NO"),
          getAction("DECISION_MAYBE"),
          getAction("EDIT")
        ];
      }
      return [];
    }
  },
  {
    id: "AGREED",
    validation: function(task) {
      return task.status === getStatus("agreed").id && !task.request && !task.locked;
    },
    actions: function(task, actorId) {
      return [
        getAction("EDIT"),
        getAction("STATUS_CHANGE_DONE"),
        getAction("STATUS_CHANGE_CANCEL"),
        getAction("LOCK"),
        getAction("RECONSIDER")
      ];
    }
  },
  {
    id: "OPPOSED",
    validation: function(task) {
      return task.status === getStatus("cancelled").id;
    },
    actions: function(task, actorId) {
      return [];
    }
  },
  {
    id: "CONSIDERED",
    validation: function(task) {
      var greenCondition = getCondition("green").id;
      return task.status === getStatus("considered").id
        && (task.author.status === greenCondition || task.receiver.status === greenCondition);
    },
    actions: function(task, actorId) {
      var greenCondition = getCondition("green").id;
      if (task.author.id === actorId && task.author.status === greenCondition
        || task.receiver.id === actorId && task.receiver.status === greenCondition) {
          return [
            getAction("EDIT"),
            getAction("STATUS_CHANGE_DONE"),
            getAction("STATUS_CHANGE_CANCEL"),
            getAction("RECONSIDER")
          ];
      }
      return [
        getAction("DECISION_YES"),
        getAction("DECISION_NO"),
        getAction("EDIT")
      ];
    }
  },
  {
    id: "DEEPLY_CONSIDERED",
    validation: function(task) {
      var yellowCondition = getCondition("yellow").id;
      return task.status === getStatus("considered").id
        && task.author.status === yellowCondition && task.receiver.status === yellowCondition;
    },
    actions: function(task, actorId) {
      return [
        getAction("DECISION_YES"),
        getAction("DECISION_NO"),
        getAction("EDIT")
      ];
    }
  }
];

export const getState = function(id) {
  var found = States.filter(x => x.id === id);
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No state named " + id);
}

export const getCurrentState = function(task) {
  var found = States.filter(x => x.validation(task));
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No state for task " + task._id);
}

//////////////////////////// TICKLERS /////////////////////////////////////////////////////////
export const Ticklers = [
  {
    id: "CONSIDERING",
    notice: getNotice("NEEDS_DECISION")
  }
];

export const getTickler = function(id) {
  var found = Ticklers.filter(x => x.id === id);
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No tickler found for id " + id);
}