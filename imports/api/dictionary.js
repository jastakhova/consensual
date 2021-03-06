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
  },
  {
    id: "DONE_REQUEST",
    text: "Agreement was marked as done",
    type: "visit"
  },
  {
    id: "DONE_NEEDS_APPROVAL",
    text: "Completion of the agreement is waiting for an approval",
    type: "visit"
  },
  {
    id: "DONE_APPROVAL",
    text: "Completion of the agreement was confirmed",
    type: "view"
  },
  {
    id: "DONE_REQUEST_DENIED",
    text: "Completion request was denied",
    type: "view"
  },
  {
    id: "DONE_REQUEST_CANCELLED",
    text: "Completion request was cancelled",
    type: "view"
  },
  {
    id: "CANCELLATION_REQUEST_CANCELLED",
    text: "Cancellation request was removed",
    type: "view"
  },
  {
    id: "CANCELLATION_NEEDS_APPROVAL",
    text: "Cancellation of the agreement is waiting for an approval",
    type: "visit"
  },
  {
    id: "OVERDUE",
    text: "Overdue",
    type: "visit"
  },
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
// One can always comment and copy. Other actions are allowed depending on the state.

export const States = [
  {
    id: "PROPOSED",
    icon: "timer",
    validation: function(task) {
      return task.status === getStatus("proposed").id;
    },
    actions: function(task, actorId) {
      if (task.author.id === actorId) {
        return [
          getAction("EDIT"),
//          getAction("STATUS_CHANGE_DONE"),
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
    icon: "paper-plane",
    validation: function(task) {
      return task.status === getStatus("agreed").id && !task.request && !task.locked;
    },
    actions: function(task, actorId) {
      if (task.author.id === task.receiver.id) {
        return [
          getAction("EDIT"),
          getAction("STATUS_CHANGE_DONE"),
          getAction("STATUS_CHANGE_CANCEL")
        ];
      }
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
    icon: "close-circle",
    validation: function(task) {
      return task.status === getStatus("cancelled").id;
    },
    actions: function(task, actorId) {
      return [];
    }
  },
  {
    id: "CONSIDERED",
    icon: "look",
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
//            getAction("STATUS_CHANGE_DONE"),
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
    icon: "look",
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
  },
  {
    id: "UNDER_REQUEST",
    icon: "way",
    validation: function(task) {
      return task.request;
    },
    actions: function(task, actorId) {
      if (task.request.actorId === actorId) {
        return [
          getAction("CANCEL_REQUEST")
        ];
      }
      return [
        getAction("REQUEST_APPROVE"),
        getAction("REQUEST_DENY")
      ];
    }
  },
  {
    id: "COMPLETED",
    icon: "check",
    validation: function(task) {
      return task.status === getStatus("done").id;
    },
    actions: function(task, actorId) {
      return [];
    }
  },
  {
    id: "LOCKED",
    icon: "lock",
    validation: function(task) {
      return !!task.locked;
    },
    actions: function(task, actorId) {
      return [
        getAction("STATUS_CHANGE_DONE"),
        getAction("STATUS_CHANGE_CANCEL")
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
  },
  {
    id: "UNDER_DONE_REQUEST",
    notice: getNotice("DONE_NEEDS_APPROVAL")
  },
  {
    id: "UNDER_CANCELLATION_REQUEST",
    notice: getNotice("CANCELLATION_NEEDS_APPROVAL")
  },
  {
    id: "OVERDUE",
    notice: getNotice("OVERDUE")
  }
];

export const getTickler = function(id) {
  var found = Ticklers.filter(x => x.id === id);
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No tickler found for id " + id);
}

//////////////////////////// REQUESTS /////////////////////////////////////////////////////////
export const Requests = [
  {
    id: "DONE",
    requestNotice: getNotice("DONE_REQUEST"),
    approvalNotice: getNotice("DONE_APPROVAL"),
    deniedNotice: getNotice("DONE_REQUEST_DENIED"),
    cancelNotice: getNotice("DONE_REQUEST_CANCELLED"),
    tickler: getTickler("UNDER_DONE_REQUEST"),
    descriptor: "Done",
    activityLogApprovalRecord: 'approved the completion request',
    activityLogDenialRecord: 'denied the completion request',
    activityLogCancelRecord: 'cancelled the completion request',
    statusOnApproval: getStatus("done"),
    // should also remove overdue ticklers and notices
    updateFields: [
      function(task) { return { field: "archived", value: true};},
      function(task) { return { field: "author.ticklers", value: []};},
      function(task) { return { field: "receiver.ticklers", value: []};}
    ]
  },
  {
    id: "CANCELLED",
    requestNotice: getNotice("CANCELLATION_REQUEST"),
    approvalNotice: getNotice("CANCELLATION_APPROVAL"),
    deniedNotice: getNotice("CANCELLATION_REQUEST_DENIED"),
    cancelNotice: getNotice("CANCELLATION_REQUEST_CANCELLED"),
    tickler: getTickler("UNDER_CANCELLATION_REQUEST"),
    descriptor: "Cancellation",
    activityLogApprovalRecord: 'approved the cancellation request',
    activityLogDenialRecord: 'denied the cancellation request',
    activityLogCancelRecord: 'cancelled the completion request',
    statusOnApproval: getStatus("cancelled"),
    updateFields: [
      function(task) { return { field: "archived", value: true};},
      function(task) { return {
        field: task.author.id === task.request.actorId ? "author.status" : "receiver.status",
        value: getCondition("red").id};},
    ]
  }
];

export const getRequest = function(id) {
  var found = Requests.filter(x => x.id === id);
  if (found.length > 0) {
    return found[0];
  }
  throw new Error("No request found for id " + id);
}