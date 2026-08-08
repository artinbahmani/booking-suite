# booking-suite

Appointment booking for salons, clinics and consultants: slot engine with conflict + buffer prevention, staff color-coded week/day calendar, auto-built customer history. Vanilla JS, no dependencies.

## Features

- **Today dashboard** — upcoming appointments, revenue today and this week, one-click status management
- **Week calendar** — 7-day grid, appointments color-coded per staff member, click a day header to zoom into day view
- **Day view** — one column per staff member, click any empty time slot to book it
- **Booking flow** — pick service, staff, date; available slots are computed live from working hours minus existing bookings, days off, and a configurable buffer between appointments; double-booking is rejected server-side... well, store-side
- **Admin setup** — services (name, duration, price) with inline editing; staff members with per-weekday working hours and a days-off calendar; booking rules (buffer minutes, slot grid size)
- **Statuses** — confirmed, completed, no-show, cancelled; cancelled/no-show appointments stop occupying slots and drop out of revenue
- **Customers** — list auto-built from bookings (keyed by phone), with visit count, total spend and full visit history per customer
- **Persistence** — everything in localStorage; JSON export/import for backup or migration; one-click reset to sample seed data

## Run

Open index.html in any modern browser. No build step, no dependencies.

## Usage

- Tabs at the top switch between Today, Calendar, Book, Customers and Admin
- In the calendar, click empty space to create a booking at that time; click an appointment to change its status or delete it
- `Esc` closes any dialog
- First launch loads sample data (3 staff, 5 services, a week of bookings around today); use **Reset demo data** in the header to restore it

## Tech notes

- Plain `<script>` tags (store.js then app.js) so the app runs over `file://` — no modules, no server
- The slot engine (`getSlots`) walks a configurable time grid inside each staff member's working hours and rejects any start time that overlaps an active booking plus the buffer on both sides; `createBooking` re-validates at write time so conflicts can't slip in from a stale UI
- Bookings snapshot service name, price and duration at creation time, so editing or deleting a service never corrupts history, revenue or the customer ledger
- The calendar renders appointments as absolutely-positioned blocks at 1px/minute inside a fixed 08:00–21:00 window, with CSS gradient hour lines — no canvas, no layout library

## Roadmap

- Recurring appointments and repeat-customer quick booking
- SMS/WhatsApp reminder hooks (via a small backend or n8n webhook)
- Multi-service appointments (e.g. color + cut in one visit) with chained slots
- Per-service staff assignment (not every staff member offers every service)
- Printable daily schedule and CSV revenue reports
- Optional week-start and currency/locale settings
