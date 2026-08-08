/* booking-suite — app.js
 * All rendering and interaction. Views: Today, Calendar (week/day), Book,
 * Customers, Admin. Depends on window.BookingStore (store.js, loaded first).
 */
(function () {
  'use strict';

  var Store = window.BookingStore;
  var U = Store.util;

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Calendar geometry: one pixel per minute within a fixed display window. */
  var CAL_OPEN = 8 * 60;    // 08:00
  var CAL_CLOSE = 21 * 60;  // 21:00
  var PX_PER_MIN = 1;

  /* UI state (not persisted) */
  var view = 'today';
  var calMode = 'week';          // 'week' | 'day'
  var calAnchor = U.todayStr();  // any date inside the shown week, or the shown day

  var app = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

  /* ---------- small helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) { return 'AED ' + Number(n || 0).toLocaleString('en-US'); }

  function fmtDateNice(dateStr) {
    var d = U.parseDate(dateStr);
    return WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function statusBadge(status) {
    return '<span class="badge badge-' + status.replace(/ /g, '-') + '">' + esc(status) + '</span>';
  }

  function staffColor(staffId) {
    var st = Store.getStaff(staffId);
    return st ? st.color : '#64748b';
  }

  function staffName(staffId) {
    var st = Store.getStaff(staffId);
    return st ? st.name : '(removed staff)';
  }

  function openModal(html) {
    modalRoot.innerHTML =
      '<div class="modal-backdrop" id="modal-backdrop">' +
        '<div class="modal" role="dialog">' + html + '</div>' +
      '</div>';
    document.getElementById('modal-backdrop').addEventListener('click', function (e) {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
  }

  function closeModal() { modalRoot.innerHTML = ''; }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  function toast(msg, isError) {
    var t = document.createElement('div');
    t.className = 'toast' + (isError ? ' toast-error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('toast-in'); }, 10);
    setTimeout(function () {
      t.classList.remove('toast-in');
      setTimeout(function () { t.remove(); }, 300);
    }, 2600);
  }

  /* ================================================================
   * TODAY DASHBOARD
   * ================================================================ */

  function renderToday() {
    var today = U.todayStr();
    var ws = U.weekStart(today);
    var we = U.addDays(ws, 6);
    var todays = Store.bookingsOn(today);
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();

    var upcoming = todays.filter(function (b) {
      return b.status === 'confirmed' && U.toMin(b.end) >= nowMin;
    });
    var active = todays.filter(function (b) { return b.status !== 'cancelled'; });

    var html = '<h2 class="view-title">Today — ' + fmtDateNice(today) + '</h2>';

    html += '<div class="stat-grid">' +
      statCard('Appointments today', active.length, '') +
      statCard('Upcoming', upcoming.length, 'accent') +
      statCard('Revenue today', money(Store.revenueBetween(today, today)), 'green') +
      statCard('Revenue this week', money(Store.revenueBetween(ws, we)), 'green') +
      '</div>';

    if (!todays.length) {
      html += '<div class="empty">No appointments today. <button class="btn btn-primary" data-goto="book">Book one</button></div>';
    } else {
      html += '<div class="card"><table class="table"><thead><tr>' +
        '<th>Time</th><th>Customer</th><th>Service</th><th>Staff</th><th>Price</th><th>Status</th><th></th>' +
        '</tr></thead><tbody>';
      todays.forEach(function (b) {
        html += '<tr class="' + (b.status === 'cancelled' ? 'row-dim' : '') + '">' +
          '<td class="mono">' + b.start + '–' + b.end + '</td>' +
          '<td>' + esc(b.customerName) + '</td>' +
          '<td>' + esc(b.serviceName) + '</td>' +
          '<td><span class="dot" style="background:' + staffColor(b.staffId) + '"></span>' + esc(staffName(b.staffId)) + '</td>' +
          '<td class="mono">' + money(b.price) + '</td>' +
          '<td>' + statusBadge(b.status) + '</td>' +
          '<td><button class="btn btn-small" data-appt="' + b.id + '">Manage</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }

    app.innerHTML = html;
  }

  function statCard(label, value, cls) {
    return '<div class="stat-card ' + cls + '"><div class="stat-value">' + value +
      '</div><div class="stat-label">' + label + '</div></div>';
  }

  /* ================================================================
   * CALENDAR (week + day)
   * ================================================================ */

  function renderCalendar() {
    var html = '<div class="cal-toolbar">' +
      '<h2 class="view-title">Calendar</h2>' +
      '<div class="cal-nav">' +
        '<button class="btn" id="cal-prev">‹</button>' +
        '<button class="btn" id="cal-today">Today</button>' +
        '<button class="btn" id="cal-next">›</button>' +
      '</div>' +
      '<div class="seg">' +
        '<button class="seg-btn' + (calMode === 'week' ? ' active' : '') + '" data-mode="week">Week</button>' +
        '<button class="seg-btn' + (calMode === 'day' ? ' active' : '') + '" data-mode="day">Day</button>' +
      '</div>' +
      '</div>';

    html += '<div class="legend">' + Store.state.staff.map(function (s) {
      return '<span class="legend-item"><span class="dot" style="background:' + s.color + '"></span>' + esc(s.name) + '</span>';
    }).join('') + '</div>';

    html += calMode === 'week' ? weekGridHTML() : dayGridHTML();
    app.innerHTML = html;

    document.getElementById('cal-prev').addEventListener('click', function () {
      calAnchor = U.addDays(calAnchor, calMode === 'week' ? -7 : -1); render();
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      calAnchor = U.addDays(calAnchor, calMode === 'week' ? 7 : 1); render();
    });
    document.getElementById('cal-today').addEventListener('click', function () {
      calAnchor = U.todayStr(); render();
    });
    app.querySelectorAll('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { calMode = b.dataset.mode; render(); });
    });

    /* Click on empty column space -> new booking at that time. */
    app.querySelectorAll('.cal-col').forEach(function (col) {
      col.addEventListener('click', function (e) {
        if (e.target.closest('.appt')) return;
        var rect = col.getBoundingClientRect();
        var mins = CAL_OPEN + (e.clientY - rect.top) / PX_PER_MIN;
        var step = Store.state.settings.step;
        mins = Math.round(mins / step) * step;
        if (mins < CAL_OPEN || mins >= CAL_CLOSE) return;
        openBookingModal({
          date: col.dataset.date,
          staffId: col.dataset.staff || null,
          time: U.toTime(mins)
        });
      });
    });

    app.querySelectorAll('.appt').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        openApptModal(el.dataset.id);
      });
    });

    app.querySelectorAll('.cal-day-head').forEach(function (h) {
      /* Day-mode staff headers carry no date — they are labels, not links. */
      if (!h.dataset.date) return;
      h.addEventListener('click', function () {
        calAnchor = h.dataset.date; calMode = 'day'; render();
      });
    });
  }

  function timeGutterHTML() {
    var html = '<div class="time-gutter">';
    for (var t = CAL_OPEN; t <= CAL_CLOSE; t += 60) {
      html += '<div class="time-label" style="top:' + ((t - CAL_OPEN) * PX_PER_MIN) + 'px">' + U.toTime(t) + '</div>';
    }
    return html + '</div>';
  }

  function apptBlockHTML(b) {
    /* Clamp to the display window in case admin sets hours outside it. */
    var startM = Math.max(U.toMin(b.start), CAL_OPEN);
    var endM = Math.min(U.toMin(b.end), CAL_CLOSE);
    if (endM <= startM) return '';
    var top = (startM - CAL_OPEN) * PX_PER_MIN;
    var height = (endM - startM) * PX_PER_MIN;
    var dim = (b.status === 'cancelled' || b.status === 'no-show') ? ' appt-dim' : '';
    return '<div class="appt' + dim + '" data-id="' + b.id + '" ' +
      'style="top:' + top + 'px;height:' + Math.max(height, 18) + 'px;' +
      'background:' + staffColor(b.staffId) + '22;border-color:' + staffColor(b.staffId) + '">' +
      '<div class="appt-time">' + b.start + '</div>' +
      '<div class="appt-name">' + esc(b.customerName) + '</div>' +
      (height >= 44 ? '<div class="appt-svc">' + esc(b.serviceName) + '</div>' : '') +
      '</div>';
  }

  function weekGridHTML() {
    var ws = U.weekStart(calAnchor);
    var colH = (CAL_CLOSE - CAL_OPEN) * PX_PER_MIN;
    var today = U.todayStr();

    var html = '<div class="cal"><div class="cal-headrow"><div class="gutter-cell"></div>';
    for (var i = 0; i < 7; i++) {
      var d = U.addDays(ws, i);
      html += '<div class="cal-day-head' + (d === today ? ' is-today' : '') + '" data-date="' + d + '">' +
        WEEKDAYS[U.weekdayOf(d)] + '<span>' + d.slice(8) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1] + '</span></div>';
    }
    html += '</div><div class="cal-body">' + timeGutterHTML();

    for (i = 0; i < 7; i++) {
      d = U.addDays(ws, i);
      html += '<div class="cal-col" data-date="' + d + '" style="height:' + colH + 'px">';
      Store.bookingsOn(d).forEach(function (b) { html += apptBlockHTML(b); });
      html += '</div>';
    }
    return html + '</div></div>';
  }

  function dayGridHTML() {
    var d = calAnchor;
    var colH = (CAL_CLOSE - CAL_OPEN) * PX_PER_MIN;
    var dayBookings = Store.bookingsOn(d);

    var html = '<h3 class="cal-subtitle">' + fmtDateNice(d) + (d === U.todayStr() ? ' (today)' : '') + '</h3>';
    html += '<div class="cal"><div class="cal-headrow"><div class="gutter-cell"></div>';
    Store.state.staff.forEach(function (s) {
      var off = s.daysOff.indexOf(d) !== -1 || !s.hours[U.weekdayOf(d)];
      html += '<div class="cal-day-head staff-head">' +
        '<span class="dot" style="background:' + s.color + '"></span>' + esc(s.name) +
        (off ? '<span class="off-tag">off</span>' : '') + '</div>';
    });
    html += '</div><div class="cal-body">' + timeGutterHTML();

    Store.state.staff.forEach(function (s) {
      html += '<div class="cal-col" data-date="' + d + '" data-staff="' + s.id + '" style="height:' + colH + 'px">';
      dayBookings.forEach(function (b) { if (b.staffId === s.id) html += apptBlockHTML(b); });
      html += '</div>';
    });
    return html + '</div></div>';
  }

  /* ---------- appointment detail modal ---------- */

  function openApptModal(id) {
    var b = Store.getBooking(id);
    if (!b) return;
    var html = '<h3>' + esc(b.serviceName) + '</h3>' +
      '<div class="modal-meta">' +
        '<div><strong>' + fmtDateNice(b.date) + '</strong> · ' + b.start + '–' + b.end + '</div>' +
        '<div><span class="dot" style="background:' + staffColor(b.staffId) + '"></span>' + esc(staffName(b.staffId)) + '</div>' +
        '<div>' + esc(b.customerName) + (b.phone ? ' · <span class="mono">' + esc(b.phone) + '</span>' : '') + '</div>' +
        (b.notes ? '<div class="notes">“' + esc(b.notes) + '”</div>' : '') +
        '<div>' + money(b.price) + ' · ' + statusBadge(b.status) + '</div>' +
      '</div>' +
      '<div class="modal-label">Set status</div>' +
      '<div class="btn-row">' +
      Store.STATUSES.map(function (s) {
        return '<button class="btn btn-small' + (s === b.status ? ' btn-primary' : '') + '" data-status="' + s + '">' + s + '</button>';
      }).join('') +
      '</div>' +
      '<div class="btn-row btn-row-end">' +
        '<button class="btn btn-danger btn-small" id="appt-delete">Delete</button>' +
        '<button class="btn btn-small" id="appt-close">Close</button>' +
      '</div>';
    openModal(html);

    modalRoot.querySelectorAll('[data-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        b.status = btn.dataset.status;
        Store.save();
        closeModal();
        render();
        toast('Status set to ' + b.status);
      });
    });
    document.getElementById('appt-delete').addEventListener('click', function () {
      if (!confirm('Delete this appointment?')) return;
      Store.state.bookings = Store.state.bookings.filter(function (x) { return x.id !== id; });
      Store.save();
      closeModal();
      render();
      toast('Appointment deleted');
    });
    document.getElementById('appt-close').addEventListener('click', closeModal);
  }

  /* ================================================================
   * BOOKING FORM (shared by Book view and calendar modal)
   * ================================================================ */

  function serviceOptions(selected) {
    return Store.state.services.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' +
        esc(s.name) + ' (' + s.duration + 'm · ' + money(s.price) + ')</option>';
    }).join('');
  }

  function staffOptions(selected) {
    return Store.state.staff.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
  }

  /* Booking form markup. initial: { serviceId, staffId, date, time } */
  function bookingFormHTML(initial) {
    return '<form class="book-form" id="book-form">' +
      '<div class="form-grid">' +
        '<label>Service<select id="bf-service" required>' + serviceOptions(initial.serviceId) + '</select></label>' +
        '<label>Staff<select id="bf-staff" required>' + staffOptions(initial.staffId) + '</select></label>' +
        '<label>Date<input type="date" id="bf-date" value="' + initial.date + '" required></label>' +
      '</div>' +
      '<div class="modal-label">Available times</div>' +
      '<div id="bf-slots" class="slot-grid"></div>' +
      '<div class="form-grid">' +
        '<label>Customer name<input id="bf-name" required placeholder="Full name"></label>' +
        '<label>Phone<input id="bf-phone" placeholder="+971…"></label>' +
      '</div>' +
      '<label>Notes<textarea id="bf-notes" rows="2" placeholder="Allergies, preferences, …"></textarea></label>' +
      '<div class="form-error" id="bf-error"></div>' +
      '<button class="btn btn-primary btn-block" type="submit">Confirm booking</button>' +
      '</form>';
  }

  /* Wire slot computation + submit. onDone(booking) called on success. */
  function wireBookingForm(root, initial, onDone) {
    var selService = root.querySelector('#bf-service');
    var selStaff = root.querySelector('#bf-staff');
    var inpDate = root.querySelector('#bf-date');
    var slotBox = root.querySelector('#bf-slots');
    var errBox = root.querySelector('#bf-error');
    var picked = null;

    function refreshSlots() {
      picked = null;
      var slots = Store.getSlots(selStaff.value, selService.value, inpDate.value);
      if (!inpDate.value) { slotBox.innerHTML = '<div class="empty-small">Pick a date first.</div>'; return; }
      if (!slots.length) {
        slotBox.innerHTML = '<div class="empty-small">No free slots — day off, non-working day, or fully booked.</div>';
        return;
      }
      slotBox.innerHTML = slots.map(function (t) {
        return '<button type="button" class="slot' + (t === initial.time ? ' picked' : '') + '" data-time="' + t + '">' + t + '</button>';
      }).join('');
      if (initial.time && slots.indexOf(initial.time) !== -1) picked = initial.time;
      initial.time = null; // only pre-pick once
      slotBox.querySelectorAll('.slot').forEach(function (b) {
        b.addEventListener('click', function () {
          slotBox.querySelectorAll('.slot').forEach(function (x) { x.classList.remove('picked'); });
          b.classList.add('picked');
          picked = b.dataset.time;
        });
      });
    }

    selService.addEventListener('change', refreshSlots);
    selStaff.addEventListener('change', refreshSlots);
    inpDate.addEventListener('change', refreshSlots);
    refreshSlots();

    root.querySelector('#book-form').addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.textContent = '';
      if (!picked) { errBox.textContent = 'Pick a time slot first.'; return; }
      var result = Store.createBooking({
        serviceId: selService.value,
        staffId: selStaff.value,
        date: inpDate.value,
        start: picked,
        customerName: root.querySelector('#bf-name').value,
        phone: root.querySelector('#bf-phone').value,
        notes: root.querySelector('#bf-notes').value
      });
      if (result.error) { errBox.textContent = result.error; refreshSlots(); return; }
      onDone(result);
    });
  }

  function openBookingModal(initial) {
    if (!initial.serviceId && Store.state.services[0]) initial.serviceId = Store.state.services[0].id;
    if (!initial.staffId && Store.state.staff[0]) initial.staffId = Store.state.staff[0].id;
    openModal('<h3>New appointment</h3>' + bookingFormHTML(initial));
    wireBookingForm(modalRoot, initial, function () {
      closeModal();
      render();
      toast('Booking confirmed');
    });
  }

  function renderBook() {
    app.innerHTML = '<h2 class="view-title">New booking</h2>' +
      '<div class="card card-narrow">' +
      bookingFormHTML({ date: U.todayStr(), serviceId: Store.state.services[0] && Store.state.services[0].id,
                        staffId: Store.state.staff[0] && Store.state.staff[0].id, time: null }) +
      '</div>';
    wireBookingForm(app, { time: null }, function () {
      toast('Booking confirmed');
      calAnchor = U.todayStr();
      view = 'calendar';
      render();
    });
  }

  /* ================================================================
   * CUSTOMERS
   * ================================================================ */

  function renderCustomers() {
    var list = Store.customers();
    var html = '<h2 class="view-title">Customers</h2>';
    if (!list.length) {
      app.innerHTML = html + '<div class="empty">No customers yet — they appear here automatically from bookings.</div>';
      return;
    }
    html += '<div class="card"><table class="table"><thead><tr>' +
      '<th>Name</th><th>Phone</th><th>Visits</th><th>Total spent</th><th>Last visit</th><th></th>' +
      '</tr></thead><tbody>';
    list.forEach(function (c, i) {
      var done = c.visits.filter(function (v) { return v.status === 'completed'; });
      var spent = done.reduce(function (s, v) { return s + (v.price || 0); }, 0);
      var last = c.visits[c.visits.length - 1];
      html += '<tr>' +
        '<td>' + esc(c.name) + '</td>' +
        '<td class="mono">' + esc(c.phone || '—') + '</td>' +
        '<td>' + c.visits.length + '</td>' +
        '<td class="mono">' + money(spent) + '</td>' +
        '<td>' + fmtDateNice(last.date) + '</td>' +
        '<td><button class="btn btn-small" data-cust="' + i + '">History</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    app.innerHTML = html;

    app.querySelectorAll('[data-cust]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = list[Number(btn.dataset.cust)];
        var h = '<h3>' + esc(c.name) + '</h3>' +
          (c.phone ? '<div class="modal-meta mono">' + esc(c.phone) + '</div>' : '') +
          '<table class="table"><thead><tr><th>Date</th><th>Service</th><th>Staff</th><th>Price</th><th>Status</th></tr></thead><tbody>';
        c.visits.slice().reverse().forEach(function (v) {
          h += '<tr><td>' + v.date + ' ' + v.start + '</td><td>' + esc(v.serviceName) + '</td>' +
            '<td>' + esc(staffName(v.staffId)) + '</td><td class="mono">' + money(v.price) + '</td>' +
            '<td>' + statusBadge(v.status) + '</td></tr>';
        });
        h += '</tbody></table><div class="btn-row btn-row-end"><button class="btn btn-small" id="appt-close">Close</button></div>';
        openModal(h);
        document.getElementById('appt-close').addEventListener('click', closeModal);
      });
    });
  }

  /* ================================================================
   * ADMIN — services, staff hours, days off, settings
   * ================================================================ */

  function renderAdmin() {
    var s = Store.state;
    var html = '<h2 class="view-title">Admin setup</h2>';

    /* --- services --- */
    html += '<div class="card"><h3 class="card-title">Services</h3>' +
      '<table class="table"><thead><tr><th>Name</th><th>Duration (min)</th><th>Price (AED)</th><th></th></tr></thead><tbody>';
    s.services.forEach(function (sv) {
      html += '<tr>' +
        '<td><input class="inline-input" data-svc-name="' + sv.id + '" value="' + esc(sv.name) + '"></td>' +
        '<td><input class="inline-input inline-num" type="number" min="5" step="5" data-svc-dur="' + sv.id + '" value="' + sv.duration + '"></td>' +
        '<td><input class="inline-input inline-num" type="number" min="0" step="5" data-svc-price="' + sv.id + '" value="' + sv.price + '"></td>' +
        '<td><button class="btn btn-small btn-danger" data-svc-del="' + sv.id + '">Delete</button></td>' +
        '</tr>';
    });
    html += '<tr class="row-new">' +
      '<td><input class="inline-input" id="svc-new-name" placeholder="New service"></td>' +
      '<td><input class="inline-input inline-num" id="svc-new-dur" type="number" min="5" step="5" value="30"></td>' +
      '<td><input class="inline-input inline-num" id="svc-new-price" type="number" min="0" step="5" value="100"></td>' +
      '<td><button class="btn btn-small btn-primary" id="svc-add">Add</button></td>' +
      '</tr></tbody></table></div>';

    /* --- staff --- */
    s.staff.forEach(function (st) {
      html += '<div class="card"><div class="staff-card-head">' +
        '<input type="color" class="color-input" data-stf-color="' + st.id + '" value="' + st.color + '" title="Calendar color">' +
        '<input class="inline-input staff-name-input" data-stf-name="' + st.id + '" value="' + esc(st.name) + '">' +
        '<button class="btn btn-small btn-danger" data-stf-del="' + st.id + '">Delete</button>' +
        '</div>' +
        '<table class="table table-compact"><thead><tr><th>Day</th><th>Working</th><th>From</th><th>To</th></tr></thead><tbody>';
      for (var d = 0; d < 7; d++) {
        var h = st.hours[d];
        html += '<tr>' +
          '<td>' + WEEKDAYS[d] + '</td>' +
          '<td><input type="checkbox" data-stf-on="' + st.id + ':' + d + '"' + (h ? ' checked' : '') + '></td>' +
          '<td><input type="time" class="inline-input" data-stf-start="' + st.id + ':' + d + '" value="' + (h ? h.start : '09:00') + '"' + (h ? '' : ' disabled') + '></td>' +
          '<td><input type="time" class="inline-input" data-stf-end="' + st.id + ':' + d + '" value="' + (h ? h.end : '18:00') + '"' + (h ? '' : ' disabled') + '></td>' +
          '</tr>';
      }
      html += '</tbody></table>' +
        '<div class="dayoff-row"><span class="modal-label">Days off</span>' +
        '<div class="chip-row" id="dayoff-' + st.id + '">' +
        st.daysOff.map(function (d) {
          return '<span class="chip">' + d + '<button class="chip-x" data-dayoff-del="' + st.id + ':' + d + '">×</button></span>';
        }).join('') +
        '</div>' +
        '<input type="date" id="dayoff-add-' + st.id + '">' +
        '<button class="btn btn-small" data-dayoff-add="' + st.id + '">Add day off</button>' +
        '</div></div>';
    });
    html += '<div class="card"><h3 class="card-title">Add staff member</h3>' +
      '<div class="form-grid">' +
      '<label>Name<input id="stf-new-name" placeholder="Full name"></label>' +
      '<label>Color<input type="color" id="stf-new-color" value="#38bdf8"></label>' +
      '</div><button class="btn btn-primary" id="stf-add">Add staff</button></div>';

    /* --- settings --- */
    html += '<div class="card"><h3 class="card-title">Booking rules</h3>' +
      '<div class="form-grid">' +
      '<label>Buffer between appointments (min)<input type="number" id="set-buffer" min="0" max="60" step="5" value="' + s.settings.buffer + '"></label>' +
      '<label>Slot grid (min)<select id="set-step">' +
        [15, 20, 30, 60].map(function (v) {
          return '<option value="' + v + '"' + (v === s.settings.step ? ' selected' : '') + '>' + v + '</option>';
        }).join('') +
      '</select></label>' +
      '</div></div>';

    app.innerHTML = html;
    wireAdmin();
  }

  function wireAdmin() {
    var s = Store.state;

    /* services */
    app.querySelectorAll('[data-svc-name]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var sv = Store.getService(inp.dataset.svcName);
        if (sv && inp.value.trim()) { sv.name = inp.value.trim(); Store.save(); toast('Saved'); }
      });
    });
    app.querySelectorAll('[data-svc-dur]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var sv = Store.getService(inp.dataset.svcDur);
        if (sv && Number(inp.value) > 0) { sv.duration = Number(inp.value); Store.save(); toast('Saved'); }
      });
    });
    app.querySelectorAll('[data-svc-price]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var sv = Store.getService(inp.dataset.svcPrice);
        if (sv && Number(inp.value) >= 0) { sv.price = Number(inp.value); Store.save(); toast('Saved'); }
      });
    });
    app.querySelectorAll('[data-svc-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.svcDel;
        var future = s.bookings.some(function (b) {
          return b.serviceId === id && b.status === 'confirmed' && b.date >= U.todayStr();
        });
        if (future) { toast('Future bookings use this service — cancel them first.', true); return; }
        if (!confirm('Delete this service? Past bookings keep their history.')) return;
        s.services = s.services.filter(function (x) { return x.id !== id; });
        Store.save(); render(); toast('Service deleted');
      });
    });
    document.getElementById('svc-add').addEventListener('click', function () {
      var name = document.getElementById('svc-new-name').value.trim();
      var dur = Number(document.getElementById('svc-new-dur').value);
      var price = Number(document.getElementById('svc-new-price').value);
      if (!name || !(dur > 0) || !(price >= 0)) { toast('Fill in name, duration and price.', true); return; }
      s.services.push({ id: U.uid(), name: name, duration: dur, price: price });
      Store.save(); render(); toast('Service added');
    });

    /* staff identity + hours */
    app.querySelectorAll('[data-stf-color]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var st = Store.getStaff(inp.dataset.stfColor);
        if (st) { st.color = inp.value; Store.save(); }
      });
    });
    app.querySelectorAll('[data-stf-name]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var st = Store.getStaff(inp.dataset.stfName);
        if (st && inp.value.trim()) { st.name = inp.value.trim(); Store.save(); toast('Saved'); }
      });
    });
    app.querySelectorAll('[data-stf-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.stfDel;
        var future = s.bookings.some(function (b) {
          return b.staffId === id && b.status === 'confirmed' && b.date >= U.todayStr();
        });
        if (future) { toast('This staff member has upcoming bookings — cancel them first.', true); return; }
        if (!confirm('Delete this staff member?')) return;
        s.staff = s.staff.filter(function (x) { return x.id !== id; });
        Store.save(); render(); toast('Staff deleted');
      });
    });

    function hoursFromUI(st, day) {
      var on = app.querySelector('[data-stf-on="' + st.id + ':' + day + '"]').checked;
      var start = app.querySelector('[data-stf-start="' + st.id + ':' + day + '"]').value;
      var end = app.querySelector('[data-stf-end="' + st.id + ':' + day + '"]').value;
      if (!on) return null;
      if (!start || !end || U.toMin(start) >= U.toMin(end)) { toast('Check ' + st.name + '’s hours — start must be before end.', true); return undefined; }
      return { start: start, end: end };
    }

    function saveHours(st) {
      var next = {};
      for (var d = 0; d < 7; d++) {
        var h = hoursFromUI(st, d);
        if (h === undefined) return false;
        next[d] = h;
      }
      st.hours = next;
      Store.save();
      return true;
    }

    app.querySelectorAll('[data-stf-on]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var parts = cb.dataset.stfOn.split(':');
        var st = Store.getStaff(parts[0]);
        var day = Number(parts[1]);
        app.querySelector('[data-stf-start="' + st.id + ':' + day + '"]').disabled = !cb.checked;
        app.querySelector('[data-stf-end="' + st.id + ':' + day + '"]').disabled = !cb.checked;
        if (saveHours(st)) toast('Hours saved');
      });
    });
    app.querySelectorAll('[data-stf-start],[data-stf-end]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var id = (inp.dataset.stfStart || inp.dataset.stfEnd).split(':')[0];
        var st = Store.getStaff(id);
        if (st && saveHours(st)) toast('Hours saved');
      });
    });

    /* days off */
    app.querySelectorAll('[data-dayoff-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var st = Store.getStaff(btn.dataset.dayoffAdd);
        var inp = document.getElementById('dayoff-add-' + st.id);
        if (!inp.value) return;
        if (st.daysOff.indexOf(inp.value) === -1) {
          st.daysOff.push(inp.value);
          st.daysOff.sort();
          Store.save();
        }
        render(); toast('Day off added');
      });
    });
    app.querySelectorAll('[data-dayoff-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.dataset.dayoffDel.split(':');
        var st = Store.getStaff(parts[0]);
        st.daysOff = st.daysOff.filter(function (d) { return d !== parts[1]; });
        Store.save(); render();
      });
    });

    /* new staff */
    document.getElementById('stf-add').addEventListener('click', function () {
      var name = document.getElementById('stf-new-name').value.trim();
      if (!name) { toast('Enter a name.', true); return; }
      s.staff.push({
        id: U.uid(), name: name,
        color: document.getElementById('stf-new-color').value,
        hours: { 0: null, 1: { start: '09:00', end: '18:00' }, 2: { start: '09:00', end: '18:00' },
                 3: { start: '09:00', end: '18:00' }, 4: { start: '09:00', end: '18:00' },
                 5: { start: '09:00', end: '18:00' }, 6: null },
        daysOff: []
      });
      Store.save(); render(); toast('Staff added');
    });

    /* settings */
    document.getElementById('set-buffer').addEventListener('change', function (e) {
      s.settings.buffer = Math.max(0, Number(e.target.value) || 0);
      Store.save(); toast('Saved');
    });
    document.getElementById('set-step').addEventListener('change', function (e) {
      s.settings.step = Number(e.target.value);
      Store.save(); toast('Saved');
    });
  }

  /* ================================================================
   * ROUTER + HEADER ACTIONS
   * ================================================================ */

  function render() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === view);
    });
    if (view === 'today') renderToday();
    else if (view === 'calendar') renderCalendar();
    else if (view === 'book') renderBook();
    else if (view === 'customers') renderCustomers();
    else if (view === 'admin') renderAdmin();
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(Store.state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'booking-suite-' + U.todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (Store.importState(obj)) { render(); toast('Data imported'); }
        else toast('That file is not a valid booking-suite export.', true);
      } catch (e) {
        toast('Could not parse that file.', true);
      }
    };
    reader.readAsText(file);
  }

  function init() {
    Store.load();

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { view = t.dataset.view; render(); });
    });

    document.getElementById('btn-export').addEventListener('click', exportJSON);
    document.getElementById('btn-import').addEventListener('click', function () {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', function (e) {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (!confirm('Reset everything back to the sample data? Your changes will be lost.')) return;
      Store.reset();
      calAnchor = U.todayStr();
      render();
      toast('Sample data restored');
    });

    /* today dashboard shortcut buttons */
    app.addEventListener('click', function (e) {
      var gotoBtn = e.target.closest('[data-goto]');
      if (gotoBtn) { view = gotoBtn.dataset.goto; render(); return; }
      var apptBtn = e.target.closest('[data-appt]');
      if (apptBtn) openApptModal(apptBtn.dataset.appt);
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
