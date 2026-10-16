# Automatic collection routes

## Daily schedule

The worker evaluates active tenants once per minute. At or after **05:00 in each tenant timezone**, it idempotently prepares the route for the following local calendar day. `collection_route_generation_runs` prevents duplicate runs and records the result.

A borrower is included when all of these are true:

- the borrower is active and approved;
- an active collector is assigned to the borrower;
- at least one active credit has an unpaid next installment whose due date is on or before the route service date.

This includes overdue installments so a missed customer is not silently removed. Daily, weekly, fortnightly, and monthly credits use the same due-date function as the operational credit schedule. One borrower becomes one stop even when multiple credits are due.

## Route ordering

The dedicated route profile receives only opaque borrower UUIDs and WGS84 coordinates. It never receives customer names, addresses, balances, payment amounts, or document data. It may only return a permutation of the supplied stop IDs.

The worker validates exact set equality. If the agent is unavailable, times out, or returns an invalid permutation, the worker uses a deterministic nearest-neighbor fallback. Stops without coordinates remain in the route at the end, in their original order.

## Manual control and traceability

- Owners and supervisors assign clients to collectors.
- A client created by a collector is assigned to that collector automatically.
- Owners, supervisors, and the assigned collector can reorder route stops manually.
- The assigned collector can mark each stop as `visited`, `not_home`, or return it to `pending`.
- Automatic routes store `service_date`, `generation_mode`, generation run totals, planner type, and an audit event.

The automation selects customers only from deterministic due-date and assignment rules. The model cannot decide who owes, approve credit, record payments, or change balances.
