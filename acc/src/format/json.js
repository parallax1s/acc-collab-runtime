"use strict";

function formatMessages(messages) {
  return JSON.stringify(messages, null, 2);
}

function formatLeases(leases) {
  return JSON.stringify(leases, null, 2);
}

function formatStatus(status) {
  return JSON.stringify(status, null, 2);
}

module.exports = { formatMessages, formatLeases, formatStatus };
