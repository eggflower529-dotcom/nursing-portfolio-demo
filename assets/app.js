/* ==========================================================================
   护理人员档案管理系统 · 原型交互脚本
   说明：本文件为原型演示逻辑（纯前端），实现菜单、页签、表格筛选/排序/分页/
   批量选择、弹窗、抽屉、浮层与提示等交互，不包含任何后端请求。
   ========================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- 顶部提示 ---------------- */
  var ICONS = {
    ok: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    info: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    warn: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/></svg>',
    err: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>'
  };
  var toastWrap = document.createElement('div');
  toastWrap.className = 'toast-wrap';
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(toastWrap); });

  window.toast = function (msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + (type === 'ok' ? 'ok' : type === 'warn' ? 'warn' : type === 'err' ? 'err' : '');
    el.innerHTML = (ICONS[type] || ICONS.info) + '<span>' + msg + '</span>';
    toastWrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .2s ease, transform .2s ease';
      el.style.opacity = '0'; el.style.transform = 'translateY(-6px)';
      setTimeout(function () { el.remove(); }, 220);
    }, 2400);
  };

  /* ---------------- 左侧菜单 ---------------- */
  function initNav() {
    $$('.nav-group > .nav-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var g = item.parentNode;
        var open = g.classList.toggle('open');
        item.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
    // 若菜单项本身是链接（无子菜单），直接跳转
    $$('.nav-item[data-href]').forEach(function (it) {
      it.addEventListener('click', function () { location.href = it.dataset.href; });
    });
  }

  /* ---------------- 页签 ---------------- */
  function initTabs() {
    $$('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('[data-tabbox]') || document;
        var name = btn.dataset.tab;
        $$('[data-tab]', box).forEach(function (b) { b.classList.toggle('on', b === btn); b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
        $$('[data-panel]', box).forEach(function (p) { p.classList.toggle('on', p.dataset.panel === name); });
      });
    });
    // 左侧导航（如字典分类、科室树）联动右侧表格筛选
    $$('[data-set-filter]').forEach(function (n) {
      n.addEventListener('click', function () {
        var key = n.dataset.setFilter;
        var ctrl = document.querySelector('[data-filter="' + key + '"]');
        if (!ctrl) return;
        ctrl.value = n.dataset.val || '';
        ctrl.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  /* ---------------- 表格（筛选 / 排序 / 分页 / 批量） ---------------- */
  var tables = {};
  function initTable(tg) {
    var table = $('table.dt[data-tg="' + tg + '"]');
    if (!table) return;
    var tbody = table.tBodies[0];
    var rows = $$('tr', tbody);
    var ths = $$('th[data-sort]', table);
    var pager = $('[data-pager][data-tg="' + tg + '"]');
    var empty = $('[data-empty][data-tg="' + tg + '"]');
    var bar = $('[data-batchbar][data-tg="' + tg + '"]');
    var st = { page: 1, size: +(table.dataset.pageSize || 10), idx: null, dir: 1, view: 'all', list: rows.slice() };

    function ctrls() {
      return $$('[data-filter][data-tg="' + tg + '"], [data-kw][data-tg="' + tg + '"], [data-range-key][data-tg="' + tg + '"]');
    }
    function match(r) {
      var cs = ctrls();
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i], v = (c.value || '').trim();
        if (!v) continue;
        if (c.hasAttribute('data-range-key')) {
          var rk = c.getAttribute('data-range-key');
          var cellV = (r.getAttribute('data-' + rk) || '');
          if (!cellV) return false;
          if (c.getAttribute('data-range-pos') === 'start' ? cellV < v : cellV > v) return false;
        } else if (c.hasAttribute('data-kw')) {
          var hay = (r.getAttribute('data-search') || '');
          if (hay.toLowerCase().indexOf(v.toLowerCase()) < 0) return false;
        } else {
          var key = c.getAttribute('data-filter');
          var cell2 = (r.getAttribute('data-' + key) || '');
          if (cell2.split('|').indexOf(v) < 0) return false;
        }
      }
      if (st.view !== 'all') {
        var flags = (r.getAttribute('data-flag') || '').split(/\s+/);
        if (flags.indexOf(st.view) < 0) return false;
      }
      return true;
    }
    function sortRows(list) {
      if (st.idx === null) return list;
      var col = st.idx;
      return list.slice().sort(function (a, b) {
        var ca = a.cells[col], cb = b.cells[col];
        var va = ca ? (ca.getAttribute('data-v') || ca.innerText.trim()) : '';
        var vb = cb ? (cb.getAttribute('data-v') || cb.innerText.trim()) : '';
        var na = parseFloat(String(va).replace(/[^\d.\-]/g, '')), nb = parseFloat(String(vb).replace(/[^\d.\-]/g, ''));
        var num = !isNaN(na) && !isNaN(nb) && /[\d]/.test(va) && /[\d]/.test(vb);
        if (num) return (na - nb) * st.dir;
        return va.localeCompare(vb, 'zh-Hans-CN') * st.dir;
      });
    }
    function render() {
      var list = sortRows(st.list.filter(match));
      var pages = Math.max(1, Math.ceil(list.length / st.size));
      if (st.page > pages) st.page = pages;
      if (st.page < 1) st.page = 1;
      var start = (st.page - 1) * st.size;
      rows.forEach(function (r) { r.style.display = 'none'; });
      list.slice(start, start + st.size).forEach(function (r) { r.style.display = ''; });
      // 重排 DOM 顺序，使显示顺序与排序一致
      list.forEach(function (r) { tbody.appendChild(r); });
      if (empty) empty.classList.toggle('show', list.length === 0);
      table.style.display = list.length === 0 ? 'none' : '';
      if (pager) renderPager(pager, list.length, st, function (p) { st.page = p; render(); });
      // 表头状态
      ths.forEach(function (th, i) {
        var ci = +th.dataset.col;
        th.classList.remove('s-asc', 's-desc');
        if (st.idx === ci) th.classList.add(st.dir > 0 ? 's-asc' : 's-desc');
      });
      updateBar();
      if (bar) $$('[data-tg="' + tg + '"][data-sel-count]', bar).forEach(function (n) { n.textContent = selected().length; });
    }
    function selected() { return rows.filter(function (r) { return r.classList.contains('sel'); }); }
    function updateBar() {
      if (!bar) return;
      var n = selected().length;
      bar.classList.toggle('show', n > 0);
      $$('[data-sel-count]').forEach(function (el) { if (el.dataset.tg === tg) el.textContent = n; });
      var all = $('input[data-ck-all]', table);
      if (all) {
        var vis = rows.filter(function (r) { return r.style.display !== 'none'; });
        var selVis = vis.filter(function (r) { return r.classList.contains('sel'); }).length;
        all.checked = vis.length > 0 && selVis === vis.length;
        all.indeterminate = selVis > 0 && selVis < vis.length;
      }
    }

    ths.forEach(function (th) {
      th.addEventListener('click', function () {
        var ci = +th.dataset.col;
        if (st.idx === ci) st.dir = -st.dir; else { st.idx = ci; st.dir = 1; }
        render();
      });
    });
    var all = $('input[data-ck-all]', table);
    if (all) {
      all.addEventListener('change', function () {
        rows.forEach(function (r) {
          if (r.style.display === 'none') return;
          r.classList.toggle('sel', all.checked);
          var c = $('input[data-row-ck]', r); if (c) c.checked = all.checked;
        });
        updateBar();
      });
    }
    tbody.addEventListener('change', function (e) {
      var c = e.target.closest('input[data-row-ck]');
      if (!c) return;
      c.closest('tr').classList.toggle('sel', c.checked);
      updateBar();
    });

    ctrls().forEach(function (c) {
      c.addEventListener('input', function () { st.page = 1; render(); });
      c.addEventListener('change', function () { st.page = 1; render(); });
      if (c.tagName === 'INPUT' && c.hasAttribute('data-kw')) {
        // 回车触发即时查询提示
        c.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { st.page = 1; render(); toast('已按条件重新加载数据', 'info'); }
        });
      }
    });
    $$('[data-chip][data-tg="' + tg + '"]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        st.view = chip.dataset.view || 'all'; st.page = 1;
        $$('[data-chip][data-tg="' + tg + '"]').forEach(function (c) { c.classList.toggle('on', c === chip); });
        render();
      });
    });
    $$('[data-reset][data-tg="' + tg + '"]').forEach(function (b) {
      b.addEventListener('click', function () {
        ctrls().forEach(function (c) { c.value = ''; });
        $$('[data-chip][data-tg="' + tg + '"]').forEach(function (c, i) { c.classList.toggle('on', i === 0); });
        st.view = 'all'; st.page = 1; render(); toast('已重置筛选条件', 'info');
      });
    });
    $$('[data-clear-sel]').forEach(function (b) {
      b.addEventListener('click', function () {
        rows.forEach(function (r) { r.classList.remove('sel'); var c = $('input[data-row-ck]', r); if (c) c.checked = false; });
        var a = $('input[data-ck-all]', table); if (a) { a.checked = false; a.indeterminate = false; }
        updateBar();
      });
    });
    tables[tg] = { render: render, rows: rows, selected: selected };
    render();
    return { render: render, selected: selected };
  }

  function renderPager(pager, total, st, go) {
    var pages = Math.max(1, Math.ceil(total / st.size));
    var from = total === 0 ? 0 : (st.page - 1) * st.size + 1;
    var to = Math.min(st.page * st.size, total);
    var nums = [];
    for (var i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - st.page) <= 2) nums.push(i);
      else if (nums[nums.length - 1] !== '...') nums.push('...');
    }
    var html = '<span class="total">共 <b>' + total + '</b> 条记录，当前显示 ' + from + '-' + to + '</span>';
    html += '<div class="pg-ctl">';
    html += '<button class="pg-btn" data-pg="prev" ' + (st.page === 1 ? 'disabled' : '') + ' aria-label="上一页">' +
      '<svg class="ico ico-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>';
    nums.forEach(function (n) {
      html += n === '...' ? '<span class="pg-btn dots">···</span>'
        : '<button class="pg-btn' + (n === st.page ? ' on' : '') + '" data-pg="' + n + '">' + n + '</button>';
    });
    html += '<button class="pg-btn" data-pg="next" ' + (st.page === pages ? 'disabled' : '') + ' aria-label="下一页">' +
      '<svg class="ico ico-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button>';
    html += '</div>';
    html += '<div class="pg-ctl"><span class="t3">每页</span><select data-pg-size>' +
      [10, 20, 50, 100].map(function (n) { return '<option value="' + n + '"' + (n === st.size ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
      '</select><span class="t3">条</span></div>';
    html += '<div class="jump t3">前往<input type="text" inputmode="numeric" data-pg-jump value="' + st.page + '" aria-label="跳转页码">页</div>';
    pager.innerHTML = html;
    $$('[data-pg]', pager).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.pg;
        if (v === 'prev') go(st.page - 1);
        else if (v === 'next') go(st.page + 1);
        else go(+v);
      });
    });
    var sel = $('[data-pg-size]', pager);
    if (sel) sel.addEventListener('change', function () { st.size = +sel.value; st.page = 1; go(st.page); });
    var jump = $('[data-pg-jump]', pager);
    if (jump) jump.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var p = parseInt(jump.value, 10); if (isNaN(p)) return;
      go(Math.min(Math.max(p, 1), pages));
    });
  }

  /* ---------------- 弹窗 / 抽屉 / 浮层 ---------------- */
  function openModal(sel) {
    var m = $(sel); if (!m) return;
    m.classList.add('show');
    document.body.appendChild(m);
    var mask = $('.mask'); if (mask) mask.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeOverlays() {
    $$('.modal.show').forEach(function (m) { m.classList.remove('show'); });
    $$('.drawer.show').forEach(function (d) { d.classList.remove('show'); });
    $$('.pop.show').forEach(function (p) { p.classList.remove('show'); });
    $$('.menu.show').forEach(function (m) { m.classList.remove('show'); });
    var mask = $('.mask'); if (mask) mask.classList.remove('show');
    document.body.style.overflow = '';
  }
  function initOverlays() {
    $$('[data-modal-open]').forEach(function (b) {
      b.addEventListener('click', function () { openModal(b.dataset.modalOpen); });
    });
    $$('[data-drawer-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = $(b.dataset.drawerOpen); if (!d) return;
        // 将触发元素上的 data-df-xxx 填充到抽屉内 #dv-xxx 节点，实现“列表中速览任意人员”
        Object.keys(b.dataset).forEach(function (k) {
          if (k.indexOf('df') !== 0) return;
          var el = document.getElementById('dv-' + k.slice(2).toLowerCase());
          if (el) el.textContent = b.dataset[k];
        });
        d.classList.add('show'); var mask = $('.mask'); if (mask) mask.classList.add('show');
        document.body.style.overflow = 'hidden';
      });
    });
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeOverlays); });
    var mask = $('.mask'); if (mask) mask.addEventListener('click', closeOverlays);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlays(); });
    // 下拉菜单
    $$('[data-menu-open]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var m = $(b.dataset.menuOpen); if (!m) return;
        var open = m.classList.contains('show');
        closeOverlays();
        if (open) return;
        document.body.appendChild(m);
        var r = b.getBoundingClientRect();
        m.classList.add('show');
        var w = m.offsetWidth, h = m.offsetHeight;
        var left = Math.min(r.left, window.innerWidth - w - 12);
        var top = r.bottom + 6;
        if (top + h > window.innerHeight - 12) top = r.top - h - 6;
        m.style.left = left + 'px'; m.style.top = top + 'px';
      });
    });
    // 消息浮层
    $$('[data-pop]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = $(b.dataset.pop); if (!p) return;
        var open = p.classList.contains('show');
        closeOverlays();
        if (open) return;
        var r = b.getBoundingClientRect();
        p.classList.add('show');
        var left = Math.min(Math.max(12, r.right - p.offsetWidth), window.innerWidth - p.offsetWidth - 12);
        p.style.left = left + 'px'; p.style.top = (r.bottom + 8) + 'px';
      });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('.menu') || e.target.closest('.pop')) return;
      closeOverlays();
    });
    // 演示用按钮：带 data-toast 的元素点击后给出反馈
    $$('[data-toast]').forEach(function (b) {
      b.addEventListener('click', function () {
        var msg = b.dataset.toast;
        msg = msg.replace('{n}', function () {
          var el = b.closest('[data-batchbar]');
          if (!el) return 0;
          var cnt = $('[data-sel-count]', el);
          return cnt ? cnt.textContent : 0;
        }());
        toast(msg, b.dataset.toastType || 'ok');
        if (b.dataset.close) closeOverlays();
      });
    });
  }

  /* ---------------- 展开更多筛选 ---------------- */
  function initMisc() {
    $$('[data-more-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var adv = $(b.dataset.moreToggle);
        if (!adv) return;
        var show = adv.classList.toggle('show');
        b.classList.toggle('open', show);
        var lb = $('[data-more-label]', b);
        if (lb) lb.textContent = show ? '收起筛选' : '展开更多筛选';
      });
    });
    // 树
    $$('.tree-node[data-toggle-node]').forEach(function (n) {
      n.addEventListener('click', function (e) {
        e.stopPropagation();
        n.classList.toggle('closed');
        var kids = n.nextElementSibling;
        if (kids && kids.classList.contains('tree-children')) kids.classList.toggle('closed');
      });
    });
    $$('.tree-node[data-select]').forEach(function (n) {
      n.addEventListener('click', function () {
        var box = n.closest('.tree') || document;
        $$('.tree-node', box).forEach(function (x) { x.classList.remove('on'); });
        n.classList.add('on');
      });
    });
    // 权限矩阵：整列全选
    $$('[data-perm-col]').forEach(function (ck) {
      ck.addEventListener('change', function () {
        var table = ck.closest('table');
        $$('tbody input[type=checkbox][data-col="' + ck.dataset.permCol + '"]', table).forEach(function (c) { c.checked = ck.checked; });
      });
    });
    $$('[data-perm-row]').forEach(function (ck) {
      ck.addEventListener('change', function () {
        $$('input[type=checkbox]', ck.closest('tr')).forEach(function (c) { c.checked = ck.checked; });
      });
    });
    // 表单内联单选/复选联动说明
    $$('[data-need]').forEach(function (el) {
      var target = $(el.dataset.need);
      if (!target) return;
      var sync = function () { target.style.display = el.checked || el.value === 'yes' ? '' : 'none'; };
      el.addEventListener('change', sync); sync();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav(); initTabs(); initOverlays(); initMisc();
    var groups = {};
    $$('table.dt[data-tg]').forEach(function (t) { groups[t.dataset.tg] = 1; });
    Object.keys(groups).forEach(function (tg) { initTable(tg); });
    // 默认展开当前页面所属菜单组，并高亮
    var act = $('.nav-sub a.active');
    if (act) { var g = act.closest('.nav-group'); if (g) { g.classList.add('open'); var it = $('.nav-item', g); if (it) it.setAttribute('aria-expanded', 'true'); } }
    // 表格容器高度自适应（保持分页器在首屏内）
    setTimeout(function () {
      $$('.tbl-scroll.tall').forEach(function (el) {
        var top = el.getBoundingClientRect().top;
        var h = window.innerHeight - top - 108;
        el.style.maxHeight = Math.max(300, h) + 'px';
      });
    }, 60);
  });
})();
