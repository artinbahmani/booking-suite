/* booking-suite — store.js
 * Data model, localStorage persistence, seed data and the slot engine.
 * Plain script (no modules) so the app works over file://.
 */
(function () {
  'use strict';

  var KEY = 'booking-suite-v1';

  /* Statuses that still occupy a staff member's time on the calendar. */
  var ACTIVE = ['confirmed', 'completed'];
  var STATUSES = ['confirmed', 'completed', 'no-show', 'cancelled'];

  /* ---------- date / time helpers (all local-time, no libraries) ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(s) {
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function addDays(dateStr, n) {
    var d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  function todayStr() { return toDateStr(new Date()); }

  /* Monday-first week start. */
  function weekStart(dateStr) {
    var d = parseDate(dateStr);
    var diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    return toDateStr(d);
  }

  function toMin(t) {
    var p = t.split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function toTime(m) {
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function weekdayOf(dateStr) { return parseDate(dateStr).getDay(); }

  /* ---------- state ---------- */

  var state = null;

  function defaults() {
    return {
      services: [],
      staff: [],
      bookings: [],
      settings: { buffer: 10, step: 30 }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.services) && Array.isArray(parsed.staff) &&
            Array.isArray(parsed.bookings)) {
          state = parsed;
          if (!state.settings) state.settings = { buffer: 10, step: 30 };
          return state;
        }
      }
    } catch (e) { /* corrupted storage — fall through to seed */ }
    state = seed();
    save();
    return state;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function reset() {
    state = seed();
    save();
    return state;
  }

  function importState(obj) {
    if (!obj || !Array.isArray(obj.services) || !Array.isArray(obj.staff) ||
        !Array.isArray(obj.bookings)) {
      return false;
    }
    state = obj;
    if (!state.settings) state.settings = { buffer: 10, step: 30 };
    save();
    return true;
  }

  /* ---------- seed data (relative to today so the dashboard is alive) ---------- */

  function seed() {
    var s = defaults();
    var today = todayStr();

    s.services = [
      { id: 'svc-cut',   name: 'Haircut & Style',   duration: 45, price: 120 },
      { id: 'svc-color', name: 'Full Color',        duration: 90, price: 350 },
      { id: 'svc-mani',  name: 'Manicure',          duration: 60, price: 180 },
      { id: 'svc-cons',  name: 'Consultation',      duration: 30, price: 200 },
      { id: 'svc-facial',name: 'Deep Clean Facial', duration: 75, price: 280 }
    ];

    s.staff = [
      {
        id: 'stf-lina', name: 'Lina Haddad', color: '#2dd4bf',
        hours: { 0: null, 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' },
                 3: { start: '09:00', end: '18:00' }, 4: { start: '09:00', end: '18:00' },
                 5: { start: '10:00', end: '20:00' }, 6: { start: '10:00', end: '16:00' } },
        daysOff: []
      },
      {
        id: 'stf-marco', name: 'Marco Reyes', color: '#a78bfa',
        hours: { 0: { start: '10:00', end: '18:00' }, 1: { start: '09:00', end: '17:00' },
                 2: null, 3: { start: '09:00', end: '17:00' },
                 4: { start: '09:00', end: '17:00' }, 5: { start: '10:00', end: '20:00' },
                 6: { start: '10:00', end: '16:00' } },
        daysOff: [addDays(today, 2)]
      },
      {
        id: 'stf-sara', name: 'Sara Nouri', color: '#fbbf24',
        hours: { 0: { start: '11:00', end: '19:00' }, 1: null,
                 2: { start: '11:00', end: '19:00' }, 3: { start: '11:00', end: '19:00' },
                 4: { start: '11:00', end: '19:00' }, 5: { start: '11:00', end: '19:00' },
                 6: null },
        daysOff: []
      }
    ];

    var customers = [
      ['Maya Khalil', '+971501112233'],
      ['Omar Farouk', '+971502223344'],
      ['Jessica Lan', '+971503334455'],
      ['Rashid Al Ameri', '+971504445566'],
      ['Elena Petrova', '+971505556677'],
      ['Huda Samir', '+971506667788'],
      ['Tom Becker', '+971507778899']
    ];

    /* [dayOffset, staffIdx, serviceIdx, startTime, customerIdx, status, notes] */
    var plan = [
      [-3, 0, 0, '10:00', 0, 'completed', ''],
      [-3, 1, 2, '12:00', 1, 'completed', ''],
      [-2, 2, 1, '12:00', 2, 'completed', 'Wants lighter shade next time'],
      [-1, 0, 3, '09:30', 3, 'completed', ''],
      [-1, 1, 0, '11:00', 4, 'no-show', ''],
      [0, 0, 0, '10:00', 5, 'completed', ''],
      [0, 0, 4, '11:30', 0, 'confirmed', 'First facial — sensitive skin'],
      [0, 1, 1, '14:00', 6, 'confirmed', ''],
      [0, 2, 2, '16:00', 2, 'confirmed', ''],
      [1, 0, 1, '10:00', 4, 'confirmed', 'Root touch-up'],
      [1, 2, 3, '13:00', 1, 'confirmed', ''],
      [2, 0, 0, '09:30', 3, 'confirmed', ''],
      [2, 2, 4, '15:00', 5, 'confirmed', ''],
      [3, 1, 2, '11:00', 6, 'confirmed', ''],
      [4, 0, 0, '12:00', 0, 'confirmed', '']
    ];

    /* Build bookings explicitly so indexes stay readable. */
    s.bookings = plan.map(function (p) {
      var dayOffset = p[0], staff = s.staff[p[1]], service = s.services[p[2]],
          start = p[3], cust = customers[p[4]], status = p[5], notes = p[6];
      var date = addDays(today, dayOffset);
      /* Skip seeds that collide with that staff member's rest day. */
      if (!staff.hours[weekdayOf(date)]) return null;
      return {
        id: uid(),
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        duration: service.duration,
        staffId: staff.id,
        date: date,
        start: start,
        end: toTime(toMin(start) + service.duration),
        customerName: cust[0],
        phone: cust[1],
        notes: notes,
        status: status,
        createdAt: Date.now()
      };
    }).filter(Boolean);

    return s;
  }

  /* ---------- lookups ---------- */

  function getService(id) {
    return state.services.find(function (s) { return s.id === id; }) || null;
  }

  function getStaff(id) {
    return state.staff.find(function (s) { return s.id === id; }) || null;
  }

  function getBooking(id) {
    return state.bookings.find(function (b) { return b.id === id; }) || null;
  }

  /* ---------- slot engine ---------- */

  /* True when [startMin, startMin+dur) collides with an active booking for
   * the staff member on dateStr, including the configured buffer on both
   * sides. Pass ignoreId when editing an existing booking. */
  function hasConflict(staffId, dateStr, startMin, dur, ignoreId) {
    var buf = state.settings.buffer;
    var endMin = startMin + dur;
    return state.bookings.some(function (b) {
      if (b.staffId !== staffId || b.date !== dateStr) return false;
      if (ignoreId && b.id === ignoreId) return false;
      if (ACTIVE.indexOf(b.status) === -1) return false;
      var bs = toMin(b.start), be = toMin(b.end);
      return startMin < be + buf && bs < endMin + buf;
    });
  }

  /* All bookable start times for a staff member + service + date.
   * Returns [] on days off or non-working weekdays. */
  function getSlots(staffId, serviceId, dateStr) {
    var staff = getStaff(staffId);
    var service = getService(serviceId);
    if (!staff || !service) return [];
    if (staff.daysOff.indexOf(dateStr) !== -1) return [];
    var hours = staff.hours[weekdayOf(dateStr)];
    if (!hours) return [];

    var dur = service.duration;
    var step = state.settings.step;
    var openMin = toMin(hours.start);
    var closeMin = toMin(hours.end);
    var slots = [];

    for (var t = openMin; t + dur <= closeMin; t += step) {
      if (!hasConflict(staffId, dateStr, t, dur, null)) slots.push(toTime(t));
    }
    return slots;
  }

  /* Create a booking after re-validating against the slot engine.
   * Returns the booking, or { error } on conflict. */
  function createBooking(input) {
    var service = getService(input.serviceId);
    var staff = getStaff(input.staffId);
    if (!service || !staff) return { error: 'Unknown service or staff member.' };
    if (staff.daysOff.indexOf(input.date) !== -1) return { error: staff.name + ' is off on that day.' };
    var hours = staff.hours[weekdayOf(input.date)];
    if (!hours) return { error: staff.name + ' does not work on that weekday.' };

    var startMin = toMin(input.start);
    if (startMin < toMin(hours.start) || startMin + service.duration > toMin(hours.end)) {
      return { error: 'That time is outside ' + staff.name + '’s working hours.' };
    }
    if (hasConflict(input.staffId, input.date, startMin, service.duration, null)) {
      return { error: 'That slot was just taken — pick another time.' };
    }

    var booking = {
      id: uid(),
      serviceId: service.id,
      serviceName: service.name,   // snapshot so history survives service edits
      price: service.price,
      duration: service.duration,
      staffId: staff.id,
      date: input.date,
      start: input.start,
      end: toTime(startMin + service.duration),
      customerName: input.customerName.trim(),
      phone: (input.phone || '').trim(),
      notes: (input.notes || '').trim(),
      status: 'confirmed',
      createdAt: Date.now()
    };
    state.bookings.push(booking);
    save();
    return booking;
  }

  /* ---------- revenue / stats ---------- */

  function bookingsOn(dateStr) {
    return state.bookings
      .filter(function (b) { return b.date === dateStr; })
      .sort(function (a, b) { return a.start < b.start ? -1 : 1; });
  }

  function revenueBetween(fromStr, toStr) {
    return state.bookings.reduce(function (sum, b) {
      if (b.date < fromStr || b.date > toStr) return sum;
      if (b.status === 'cancelled' || b.status === 'no-show') return sum;
      return sum + (b.price || 0);
    }, 0);
  }

  /* Customers are derived from bookings, keyed by phone (fallback: name). */
  function customers() {
    var map = {};
    state.bookings.forEach(function (b) {
      var key = b.phone || b.customerName.toLowerCase();
      if (!map[key]) map[key] = { name: b.customerName, phone: b.phone, visits: [] };
      map[key].visits.push(b);
    });
    return Object.keys(map).map(function (k) {
      var c = map[k];
      c.visits.sort(function (a, b) {
        return a.date === b.date ? (a.start < b.start ? -1 : 1) : (a.date < b.date ? -1 : 1);
      });
      return c;
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  }

  /* ---------- public API ---------- */

  window.BookingStore = {
    ACTIVE: ACTIVE,
    STATUSES: STATUSES,
    get state() { return state; },
    load: load,
    save: save,
    reset: reset,
    importState: importState,
    getService: getService,
    getStaff: getStaff,
    getBooking: getBooking,
    getSlots: getSlots,
    hasConflict: hasConflict,
    createBooking: createBooking,
    bookingsOn: bookingsOn,
    revenueBetween: revenueBetween,
    customers: customers,
    util: {
      pad: pad, toDateStr: toDateStr, parseDate: parseDate, addDays: addDays,
      todayStr: todayStr, weekStart: weekStart, toMin: toMin, toTime: toTime,
      uid: uid, weekdayOf: weekdayOf
    }
  };
})();
