# API

NestJS TypeScript modular monolith. See
[docs/adr/0001-tech-stack.md](../../docs/adr/0001-tech-stack.md) for why
NestJS over Fastify/Go/Elixir.

This app runs the operational business system:

- Multi-tenancy
- Auth
- Staff and permissions
- Audit logs
- Restaurant workflows
- Orders
- Payments
- Inventory
- Customers
- Reports
- Offline sync

Hotel and retail modules exist as later vertical placeholders. Restaurant OS is
the first implementation target.

