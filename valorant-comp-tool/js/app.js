/*
 * app.js —— 界面逻辑与交互
 * -----------------------------------------------------------------
 * 负责：标签页切换、地图展示与点位、英雄图鉴与选手推荐、英雄池编辑、
 *       阵容生成与拖拽微调、保存/日志/历史版本、实时协作刷新。
 */
(function () {
  var D = VCT.data, S = VCT.store, A = VCT.assets, G = VCT.generator;

  // 运行时状态
  var state = {
    room: null,
    nick: localStorage.getItem('vct_nick') || '',
    members: [],
    editingMemberId: null,     // 正在编辑的成员(null=新建)
    editDraft: null,           // 成员编辑草稿 {nickname, roles, agents}
    currentComp: null,         // 当前生成的阵容结果
    currentMapId: null,
    logs: []                   // 编辑日志缓存(用于筛选查询)
  };

  // ---------- DOM 便捷 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function openModal(html) { $('#modalBox').innerHTML = html; $('#modalMask').classList.add('show'); }
  function closeModal() { $('#modalMask').classList.remove('show'); }
  $('#modalMask').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

  function roleClass(role) { return 'role-' + role; }
  function roleCn(role) { return D.ROLES[role].cn; }

  // 统一的图片标签：懒加载 + 异步解码 + 失败兜底，减少卡顿与裂图(性能优化)
  function img(src, alt, extraClass, extraStyle) {
    return '<img loading="lazy" decoding="async"' +
      (extraClass ? ' class="' + extraClass + '"' : '') +
      (extraStyle ? ' style="' + extraStyle + '"' : '') +
      ' src="' + src + '" alt="' + esc(alt || '') + '"' +
      ' onerror="this.classList.add(\'img-broken\');this.removeAttribute(\'src\');"/>';
  }

  // =================================================================
  // 初始化
  // =================================================================
  function init() {
    // 模式徽标
    var badge = $('#modeBadge');
    if (S.isCloud) { badge.textContent = '☁ 云端协作已连接'; badge.className = 'mode-badge cloud'; }
    else { badge.textContent = '💾 本地模式(未配置云端)'; badge.className = 'mode-badge local'; }

    // 昵称
    var nickInput = $('#nickInput');
    nickInput.value = state.nick;
    nickInput.addEventListener('input', function () {
      state.nick = nickInput.value.trim();
      localStorage.setItem('vct_nick', state.nick);
    });

    // 标签切换
    $all('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchView(tab.dataset.view); });
    });

    // 渲染静态内容
    renderMapGrid();
    renderAgentCodex();
    renderCompMapSelect();
    setupSync();

    // 连接房间 + 拉取协作数据
    S.getOrCreateRoom('社群团队房间').then(function (room) {
      state.room = room;
      return refreshMembers();
    }).then(function () {
      subscribeRealtime();
      refreshLogs();
    }).catch(function (e) {
      console.error(e);
      toast('数据连接异常：' + (e.message || e));
    });
  }

  function switchView(view) {
    $all('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === view); });
    $all('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    if (view === 'logs') refreshLogs();
    if (view === 'pool') renderMemberList();
  }

  // =================================================================
  // 地图页
  // =================================================================
  function renderMapGrid() {
    var grid = $('#mapGrid'); grid.innerHTML = '';
    D.maps.forEach(function (m) {
      var card = el('div', 'card map-card');
      card.innerHTML =
        '<div class="thumb">' + img(A.mapThumb(m), m.cn) + '</div>' +
        '<div class="sites">' + m.sites + ' 个炸弹点</div>' +
        '<div class="meta"><div class="cn">' + esc(m.cn) + '</div><div class="en">' + esc(m.en.toUpperCase()) + '</div></div>';
      card.addEventListener('click', function () { showMapDetail(m.id); });
      grid.appendChild(card);
    });
  }

  // ---------- 地图池 API 同步 ----------
  function setupSync() {
    var verEl = $('#poolVer');
    if (verEl) verEl.textContent = '地图池版本：' + (D.POOL_VERSION || '—');
    var statusEl = $('#syncStatus');
    var btn = $('#syncBtn');

    function showStatus() {
      if (!statusEl) return;
      var t = VCT.sync.lastSyncTime();
      statusEl.textContent = t ? ('上次同步：' + S.formatTime(new Date(t).toISOString())) : '未同步(使用内置数据)';
    }
    showStatus();

    function doSync(force) {
      if (!VCT.sync) return;
      if (btn) { btn.disabled = true; btn.textContent = '⏳ 同步中…'; }
      VCT.sync.run({ force: force }).then(function (r) {
        if (btn) { btn.disabled = false; btn.textContent = '🔄 从官方 API 同步'; }
        if (!r.ok) { if (statusEl) statusEl.textContent = '同步失败(继续用内置数据)：' + r.error; return; }
        // 合并可能新增了英雄/地图 → 重渲染相关视图
        renderMapGrid(); renderAgentCodex(); renderCompMapSelect();
        showStatus();
        var addedMsg = [];
        if (r.agents && r.agents.added.length) addedMsg.push('英雄+' + r.agents.added.length);
        if (r.maps && r.maps.added.length) addedMsg.push('地图+' + r.maps.added.length);
        if (force || addedMsg.length) toast('同步完成' + (addedMsg.length ? '（' + addedMsg.join('，') + '）' : '（已是最新）'));
      });
    }

    if (btn) btn.addEventListener('click', function () { doSync(true); });
    // 启动时后台静默同步(用缓存优先，不阻塞首屏)
    doSync(false);
  }

  function showMapDetail(mapId) {
    var m = D.mapById[mapId];
    $('#mapsIndex').style.display = 'none';
    var box = $('#mapDetail'); box.style.display = 'block';

    var dotsHtml = m.lineups.map(function (lp, i) {
      return '<div class="lineup-dot ' + lp.side + '" data-i="' + i + '" style="left:' + lp.x + '%;top:' + lp.y + '%">' + (i + 1) + '</div>';
    }).join('');

    var listHtml = m.lineups.map(function (lp, i) {
      var ag = D.agentById[lp.agent];
      var sideCn = lp.side === 'attack' ? '进攻' : '防守';
      var numColor = lp.side === 'attack' ? 'var(--val-red)' : '#2b7fff';
      return '<div class="lineup-item" data-i="' + i + '">' +
        '<div class="num" style="background:' + numColor + '">' + (i + 1) + '</div>' +
        '<div class="body"><div class="head">' +
        (ag ? img(A.agentIcon(ag), ag.cn, null, 'width:22px;height:22px;border-radius:4px;background:var(--bg-3)') : '') +
        '<span class="agent">' + (ag ? esc(ag.cn) : esc(lp.agent)) + '</span>' +
        '<span style="color:var(--text-2);font-size:12px">' + esc(lp.ability) + '</span>' +
        '<span class="side ' + lp.side + '">' + sideCn + '</span>' +
        '</div><div class="note">' + esc(lp.note) + '</div></div></div>';
    }).join('');

    box.innerHTML =
      '<button class="btn ghost small" id="backToMaps">← 返回地图列表</button>' +
      '<div class="map-detail" style="margin-top:14px">' +
        '<div class="map-hero">' + img(A.mapSplash(m), m.cn) +
          '<div class="overlay"><h2>' + esc(m.cn) + ' <span style="font-size:16px;color:var(--text-2)">' + esc(m.en) + '</span></h2>' +
          '<p>' + esc(m.summary) + '</p></div></div>' +
        '<div class="card" id="savedCompPanel" style="padding:14px"><div class="empty">正在读取该地图已保存的阵容…</div></div>' +
        '<div class="minimap-wrap">' +
          '<div class="card minimap-box"><h3 style="margin:0 0 8px">小地图 · 常用道具点位</h3>' +
            '<div class="lineup-legend">' +
              '<span class="k"><span class="swatch" style="background:var(--val-red)"></span>进攻方道具</span>' +
              '<span class="k"><span class="swatch" style="background:#2b7fff"></span>防守方道具</span>' +
              '<span style="color:var(--text-2)">悬停编号查看说明</span>' +
            '</div>' +
            '<div class="minimap-inner">' + img(A.mapMinimap(m), '小地图') + dotsHtml + '</div>' +
          '</div>' +
          '<div class="card" style="padding:14px"><h3 style="margin:0 0 8px">点位详情（' + m.lineups.length + '）</h3>' +
            '<div class="lineup-list">' + listHtml + '</div></div>' +
        '</div>' +
      '</div>';

    $('#backToMaps').addEventListener('click', function () {
      box.style.display = 'none'; $('#mapsIndex').style.display = 'block';
    });

    // 点位 ↔ 列表 联动高亮
    function link(i, on) {
      var dot = box.querySelector('.lineup-dot[data-i="' + i + '"]');
      var item = box.querySelector('.lineup-item[data-i="' + i + '"]');
      if (dot) dot.style.transform = 'translate(-50%,-50%) scale(' + (on ? 1.3 : 1) + ')';
      if (item) item.classList.toggle('hi', on);
    }
    $all('.lineup-dot', box).forEach(function (d) {
      var i = d.dataset.i;
      d.addEventListener('mouseenter', function () { link(i, true); });
      d.addEventListener('mouseleave', function () { link(i, false); });
    });
    $all('.lineup-item', box).forEach(function (it) {
      var i = it.dataset.i;
      it.addEventListener('mouseenter', function () { link(i, true); });
      it.addEventListener('mouseleave', function () { link(i, false); });
    });

    // 读取并展示该地图已保存的团队阵容
    renderSavedCompPanel(mapId);
  }

  // 在地图详情页展示该地图已保存的阵容(点击地图即可查看)
  function renderSavedCompPanel(mapId) {
    var panel = $('#savedCompPanel');
    if (!panel || !state.room) { if (panel) panel.style.display = 'none'; return; }
    S.getComposition(state.room.id, mapId).then(function (comp) {
      if (!comp || !comp.assignments || !comp.assignments.length) {
        panel.innerHTML = '<h3 style="margin:0 0 6px">团队阵容</h3>' +
          '<div class="empty">该地图还没有保存阵容。到「⚔️ 阵容生成」生成并保存后，这里会展示。</div>';
        return;
      }
      var cards = comp.assignments.map(function (as) {
        var a = D.agentById[as.agentId];
        return '<div class="saved-slot"><div class="role-strip bg-' + as.role + '"></div>' +
          '<div class="saved-portrait">' + (a ? img(A.agentThumb(a), a.cn) : '') + '</div>' +
          '<div class="saved-info"><div class="s-agent">' + (a ? esc(a.cn) : '?') + '</div>' +
          '<div class="s-member">' + esc(as.memberName || '（待认领）') + '</div></div></div>';
      }).join('');
      panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<h3 style="margin:0">团队阵容 · 已保存</h3>' +
        '<span style="font-size:12px;color:var(--text-2)">' + esc(comp.updated_by || '') + ' · ' + S.formatTime(comp.updated_at) + '</span></div>' +
        '<div class="saved-comp-grid">' + cards + '</div>' +
        '<button class="btn ghost small" id="editSavedComp" style="margin-top:10px">✎ 到阵容页编辑</button>';
      var edit = $('#editSavedComp');
      if (edit) edit.addEventListener('click', function () {
        switchView('comp');
        $('#compMapSelect').value = mapId;
        loadSavedComp(mapId, true);
      });
    }).catch(function () {
      panel.innerHTML = '<div class="empty">读取阵容失败。</div>';
    });
  }

  // =================================================================
  // 英雄图鉴
  // =================================================================
  function renderAgentCodex() {
    var box = $('#agentCodex'); box.innerHTML = '';
    D.ROLE_ORDER.forEach(function (role) {
      var info = D.ROLES[role];
      var list = D.agentsByRole[role];
      var block = el('div', 'role-block');
      block.innerHTML =
        '<div class="role-header"><div class="bar bg-' + role + '"></div>' +
        '<h3>' + info.cn + '</h3><span class="count">' + list.length + ' 名 · ' + esc(info.desc) + '</span></div>' +
        '<div class="agent-grid" id="codex-' + role + '"></div>';
      box.appendChild(block);
      var grid = block.querySelector('#codex-' + role);
      list.forEach(function (a) { grid.appendChild(agentCard(a, false)); });
    });
  }

  // 生成一个英雄卡片；selectable=true 用于英雄池选择
  function agentCard(a, selectable, selectedSet, onToggle) {
    var card = el('div', 'agent-card');
    card.innerHTML =
      '<div class="role-dot bg-' + a.role + '"></div>' +
      img(A.agentThumb(a), a.cn) +
      '<div class="name">' + esc(a.cn) + '<span class="en">' + esc(a.en) + '</span></div>';
    if (selectable) {
      if (selectedSet && selectedSet.has(a.id)) card.classList.add('selected');
      card.addEventListener('click', function () {
        card.classList.toggle('selected');
        onToggle(a.id, card.classList.contains('selected'));
      });
    } else {
      card.addEventListener('click', function () { showProRecommend(a); });
    }
    return card;
  }

  // 职业选手推荐弹窗
  function showProRecommend(a) {
    var pros = D.prosByAgent[a.id] || [];
    var html = '<span class="close" id="mClose">×</span>' +
      '<div style="display:flex;gap:12px;align-items:center">' +
      '<img src="' + A.agentIcon(a) + '" style="width:52px;height:52px;border-radius:10px;background:var(--bg-3)"/>' +
      '<div><h3>' + esc(a.cn) + ' <span style="color:var(--text-2);font-size:14px">' + esc(a.en) + '</span></h3>' +
      '<span class="role-pill ' + roleClass(a.role) + '">' + roleCn(a.role) + '</span></div></div>' +
      '<p style="color:var(--text-1);font-size:13px;margin:14px 0 6px">擅长该英雄的知名 VCT 职业选手：</p>';
    if (!pros.length) {
      html += '<div class="empty">暂无收录该英雄的招牌选手，可参考同位置其他选手打法。</div>';
    } else {
      html += pros.map(function (p) {
        return '<div class="pro-item"><span class="p-name">' + esc(p.name) + '</span>' +
          '<span class="p-team">' + esc(p.team) + '</span>' +
          '<span class="p-region">' + (D.REGION_CN[p.region] || p.region) + '</span>' +
          '<span class="p-note">' + esc(p.note) + '</span></div>';
      }).join('');
    }
    openModal(html);
    $('#mClose').addEventListener('click', closeModal);
  }

  // =================================================================
  // 英雄池 —— 成员管理
  // =================================================================
  function refreshMembers() {
    if (!state.room) return Promise.resolve();
    return S.listMembers(state.room.id).then(function (list) {
      state.members = list; renderMemberList();
    });
  }

  function renderMemberList() {
    var box = $('#memberList'); if (!box) return;
    box.innerHTML = '';
    if (!state.members.length) {
      box.appendChild(el('div', 'empty', '还没有成员，点击右上「添加成员」开始。'));
      updateAddBtn();
      return;
    }
    var starters = state.members.filter(function (m) { return m.is_starter !== false; });
    var subs = state.members.filter(function (m) { return m.is_starter === false; });

    box.appendChild(groupHeader('首发阵容', starters.length, 5, 'starter'));
    if (!starters.length) box.appendChild(el('div', 'empty', '暂无首发，从下方替补「设为首发」或新建成员。'));
    starters.forEach(function (m) { box.appendChild(memberItem(m, true)); });

    box.appendChild(groupHeader('替补 / 轮换', subs.length, null, 'bench'));
    if (!subs.length) box.appendChild(el('div', 'empty', '暂无替补。'));
    subs.forEach(function (m) { box.appendChild(memberItem(m, false)); });

    updateAddBtn();
  }

  function groupHeader(title, count, max, kind) {
    var h = el('div', 'group-header');
    var right = max ? ('<span class="g-count' + (count > max ? ' over' : '') + '">' + count + ' / ' + max + '</span>')
                    : ('<span class="g-count">' + count + '</span>');
    h.innerHTML = '<span class="g-title">' + title + '</span>' + right;
    return h;
  }

  function memberItem(m, isStarter) {
    var item = el('div', 'card member-item' + (state.editingMemberId === m.id ? ' active' : ''));
    var rolesHtml = (m.roles || []).map(function (r) {
      return '<span class="role-pill ' + roleClass(r) + '">' + roleCn(r) + '</span>';
    }).join('');
    var agentsHtml = (m.agents || []).slice(0, 10).map(function (aid) {
      var a = D.agentById[aid]; return a ? img(A.agentIcon(a), a.cn) : '';
    }).join('');
    var groupBtn = isStarter
      ? '<button class="btn ghost small" data-act="bench">↓ 转替补</button>'
      : '<button class="btn ghost small" data-act="start">↑ 设为首发</button>';
    item.innerHTML =
      '<div class="top"><span class="nick">' + esc(m.nickname) + '</span>' +
      '<span>' + groupBtn +
      ' <button class="btn ghost small" data-act="edit">编辑</button>' +
      ' <button class="btn ghost small" data-act="del">删除</button></span></div>' +
      '<div class="roles">' + (rolesHtml || '<span style="color:var(--text-2);font-size:12px">未选位置</span>') + '</div>' +
      '<div class="agents">' + (agentsHtml || '<span style="color:var(--text-2);font-size:12px">未选英雄</span>') + '</div>';
    item.querySelector('[data-act="edit"]').addEventListener('click', function () { startEditMember(m); });
    item.querySelector('[data-act="del"]').addEventListener('click', function () { confirmDeleteMember(m); });
    var gb = item.querySelector('[data-act="bench"]') || item.querySelector('[data-act="start"]');
    if (gb) gb.addEventListener('click', function () { toggleStarter(m, !isStarter); });
    return item;
  }

  // 首发/替补切换：转首发时校验上限5人
  function toggleStarter(m, toStarter) {
    if (toStarter) {
      var starters = state.members.filter(function (x) { return x.is_starter !== false; }).length;
      if (starters >= 5) { toast('首发已满 5 人，请先把某位首发转为替补'); return; }
    }
    S.setMemberGroup(m.id, toStarter)
      .then(function () {
        return S.addLog(state.room.id, {
          actor: state.nick || '匿名', action: toStarter ? '设为首发' : '转为替补',
          change_type: 'edit', target: '成员:' + m.nickname,
          detail: m.nickname + ' → ' + (toStarter ? '首发' : '替补'),
          diff: { changes: [{ slot: m.nickname, from: toStarter ? '替补' : '首发', to: toStarter ? '首发' : '替补' }] }
        });
      })
      .then(function () { toast(toStarter ? '已设为首发' : '已转替补'); refreshLogs(); return refreshMembers(); })
      .catch(function (e) { toast('操作失败：' + (e.message || e)); });
  }

  function updateAddBtn() {
    // 成员总数无硬上限；仅首发限 5 人。按钮始终可用
    var addBtn = $('#addMemberBtn');
    addBtn.disabled = false; addBtn.textContent = '+ 添加成员';
    addBtn.style.opacity = 1; addBtn.style.cursor = 'pointer';
  }

  $('#addMemberBtn').addEventListener('click', function () {
    startEditMember(null);
  });

  function startEditMember(m) {
    state.editingMemberId = m ? m.id : null;
    state.editDraft = {
      nickname: m ? m.nickname : (state.nick || ''),
      roles: m ? (m.roles || []).slice() : [],
      agents: m ? (m.agents || []).slice() : []
    };
    renderMemberList();
    renderMemberEditor();
  }

  function renderMemberEditor() {
    var box = $('#memberEditor');
    var d = state.editDraft;
    if (!d) { box.innerHTML = '<div class="empty">选择左侧成员进行编辑，或点击「添加成员」新建。</div>'; return; }

    var roleChoices = D.ROLE_ORDER.map(function (r) {
      var on = d.roles.indexOf(r) >= 0;
      return '<div class="role-choice ' + (on ? 'on bg-' + r : '') + '" data-role="' + r + '">' + roleCn(r) + '</div>';
    }).join('');

    box.innerHTML =
      '<h3 style="margin:0 0 4px">' + (state.editingMemberId ? '编辑成员' : '新建成员') + '</h3>' +
      '<label>昵称</label><input class="text" id="edNick" maxlength="16" value="' + esc(d.nickname) + '" placeholder="队员昵称"/>' +
      '<label>擅长位置（可多选）</label><div class="role-choices" id="edRoles">' + roleChoices + '</div>' +
      '<label>擅长英雄（点击选择，已选 <b id="edCount">' + d.agents.length + '</b> 名）</label>' +
      '<div id="edAgents"></div>' +
      '<div class="editor-actions"><button class="btn primary" id="edSave">保存</button>' +
      '<button class="btn ghost" id="edCancel">取消</button></div>';

    // 位置选择
    $all('#edRoles .role-choice').forEach(function (c) {
      c.addEventListener('click', function () {
        var r = c.dataset.role, i = d.roles.indexOf(r);
        if (i >= 0) { d.roles.splice(i, 1); c.className = 'role-choice'; }
        else { d.roles.push(r); c.className = 'role-choice on bg-' + r; }
      });
    });

    // 英雄选择(按位置分组，复用图鉴卡片)
    var selectedSet = new Set(d.agents);
    var agBox = $('#edAgents');
    D.ROLE_ORDER.forEach(function (role) {
      var info = D.ROLES[role];
      var block = el('div', 'role-block');
      block.innerHTML = '<div class="role-header"><div class="bar bg-' + role + '"></div><h3 style="font-size:14px">' + info.cn + '</h3></div>';
      var grid = el('div', 'agent-grid');
      D.agentsByRole[role].forEach(function (a) {
        grid.appendChild(agentCard(a, true, selectedSet, function (aid, on) {
          var idx = d.agents.indexOf(aid);
          if (on && idx < 0) d.agents.push(aid);
          if (!on && idx >= 0) d.agents.splice(idx, 1);
          $('#edCount').textContent = d.agents.length;
        }));
      });
      block.appendChild(grid); agBox.appendChild(block);
    });

    $('#edCancel').addEventListener('click', function () {
      state.editDraft = null; state.editingMemberId = null; renderMemberEditor(); renderMemberList();
    });
    $('#edSave').addEventListener('click', saveMember);
  }

  function saveMember() {
    var d = state.editDraft;
    d.nickname = $('#edNick').value.trim();
    if (!d.nickname) { toast('请填写成员昵称'); return; }
    if (!d.roles.length) { toast('请至少选择一个擅长位置'); return; }
    var actor = state.nick || d.nickname;
    var isNew = !state.editingMemberId;
    // 取旧值用于对比
    var prev = isNew ? null : state.members.filter(function (x) { return x.id === state.editingMemberId; })[0];
    var memberDiff = buildMemberDiff(prev, d);
    S.upsertMember(state.room.id, { id: state.editingMemberId, nickname: d.nickname, roles: d.roles, agents: d.agents })
      .then(function () {
        return S.addLog(state.room.id, {
          actor: actor, action: isNew ? '新增成员' : '更新英雄池',
          change_type: isNew ? 'add' : 'edit', target: '成员:' + d.nickname,
          detail: d.nickname + '：位置[' + d.roles.map(roleCn).join('/') + ']，英雄 ' + d.agents.length + ' 名',
          diff: memberDiff
        });
      })
      .then(function () {
        state.editDraft = null; state.editingMemberId = null;
        toast('已保存'); refreshLogs(); return refreshMembers();
      })
      .then(function () { renderMemberEditor(); })
      .catch(function (e) { toast('保存失败：' + (e.message || e)); });
  }

  // 成员英雄池前→后对比(位置、英雄)
  function buildMemberDiff(prev, draft) {
    function rolesLabel(rs) { return (rs || []).map(roleCn).join('/') || '（无）'; }
    function agentsLabel(as) {
      return (as || []).map(function (id) { var a = D.agentById[id]; return a ? a.cn : id; }).join('、') || '（无）';
    }
    var changes = [];
    var beforeRoles = prev ? rolesLabel(prev.roles) : '（新建）';
    var afterRoles = rolesLabel(draft.roles);
    if (beforeRoles !== afterRoles) changes.push({ slot: '擅长位置', from: beforeRoles, to: afterRoles });
    var beforeAgents = prev ? agentsLabel(prev.agents) : '（新建）';
    var afterAgents = agentsLabel(draft.agents);
    if (beforeAgents !== afterAgents) changes.push({ slot: '擅长英雄', from: beforeAgents, to: afterAgents });
    return { before: [beforeRoles, beforeAgents], after: [afterRoles, afterAgents], changes: changes };
  }

  function confirmDeleteMember(m) {
    openModal('<h3>删除成员</h3><p style="color:var(--text-1)">确定删除成员「' + esc(m.nickname) + '」吗？此操作会记录到编辑日志。</p>' +
      '<div class="editor-actions"><button class="btn primary" id="delYes">确定删除</button>' +
      '<button class="btn ghost" id="delNo">取消</button></div>');
    $('#delNo').addEventListener('click', closeModal);
    $('#delYes').addEventListener('click', function () {
      S.deleteMember(m.id)
        .then(function () { return S.addLog(state.room.id, {
          actor: state.nick || '匿名', action: '删除成员',
          change_type: 'delete', target: '成员:' + m.nickname,
          detail: '移除成员 ' + m.nickname,
          diff: { before: [m.nickname], after: ['（已删除）'], changes: [{ slot: m.nickname, from: '存在', to: '已删除' }] }
        }); })
        .then(function () { closeModal(); toast('已删除'); refreshLogs(); return refreshMembers(); })
        .catch(function (e) { toast('删除失败：' + (e.message || e)); });
    });
  }

  // =================================================================
  // 阵容生成
  // =================================================================
  function renderCompMapSelect() {
    var sel = $('#compMapSelect'); sel.innerHTML = '';
    D.maps.forEach(function (m) {
      var o = el('option'); o.value = m.id; o.textContent = m.cn + '（' + m.en + '）'; sel.appendChild(o);
    });
  }

  $('#genCompBtn').addEventListener('click', function () {
    var mapId = $('#compMapSelect').value;
    state.currentMapId = mapId;
    var result = G.generate(mapId, state.members);
    state.currentComp = result;
    renderCompResult(result);
  });

  // 读取该地图已保存的协作阵容(用于查看/继续编辑)
  function loadSavedComp(mapId, silent) {
    return S.getComposition(state.room.id, mapId).then(function (comp) {
      if (!comp || !comp.assignments || !comp.assignments.length) {
        if (!silent) toast('该地图还没有保存过阵容，可先「生成阵容」');
        return false;
      }
      state.currentMapId = mapId;
      state.currentComp = {
        assignments: comp.assignments.map(function (x) {
          return { memberId: x.memberId, memberName: x.memberName, agentId: x.agentId, role: x.role, source: '已保存' };
        }),
        template: (D.comps[mapId] || [])[0],
        notes: ['已读取 ' + (comp.updated_by || '') + ' 于 ' + S.formatTime(comp.updated_at) + ' 保存的阵容。']
      };
      renderCompResult(state.currentComp);
      return true;
    });
  }

  $('#loadCompBtn').addEventListener('click', function () {
    loadSavedComp($('#compMapSelect').value, false);
  });

  // 切换地图时，若已有保存则自动读取
  $('#compMapSelect').addEventListener('change', function () {
    state.currentMapId = $('#compMapSelect').value;
    loadSavedComp(state.currentMapId, true);
  });

  function renderCompResult(result) {
    var box = $('#compResult'); box.innerHTML = '';
    $('#compTemplateName').textContent = result.template ? '参考模板：' + result.template.name : '';
    result.assignments.forEach(function (as, idx) {
      box.appendChild(compSlot(as, idx));
    });
    // 备注
    var notesBox = $('#compNotes'); notesBox.innerHTML = '';
    (result.notes || []).forEach(function (n) {
      notesBox.appendChild(el('div', 'note', '💡 ' + esc(n)));
    });
    if (result.template) {
      notesBox.appendChild(el('div', 'note', '📖 ' + esc(result.template.desc)));
    }
    $('#compActions').style.display = state.currentComp ? 'flex' : 'none';
  }

  function compSlot(as, idx) {
    var a = D.agentById[as.agentId];
    var slot = el('div', 'comp-slot');
    slot.dataset.idx = idx;
    slot.innerHTML =
      '<div class="role-strip bg-' + as.role + '"></div>' +
      '<div class="portrait">' + (a ? img(A.agentPortrait(a), a.cn) : '') +
        '<button class="slot-edit" title="修改英雄/位置">✎</button></div>' +
      '<div class="info"><div class="agent">' + (a ? esc(a.cn) : '?') + '</div>' +
      '<div class="member">' + esc(as.memberName || '（待认领）') + '</div>' +
      '<div class="source">' + esc(as.source || '') + ' · ' + roleCn(as.role) + '</div></div>';

    // 单槽编辑：修改该位置的英雄与角色
    slot.querySelector('.slot-edit').addEventListener('click', function (e) {
      e.stopPropagation();
      editSlot(idx);
    });

    // 拖拽微调：把某个成员拖到另一个槽 → 交换成员
    slot.setAttribute('draggable', 'true');
    slot.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', idx);
    });
    slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', function () { slot.classList.remove('dragover'); });
    slot.addEventListener('drop', function (e) {
      e.preventDefault(); slot.classList.remove('dragover');
      var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      var to = idx;
      if (isNaN(from) || from === to) return;
      swapAssignmentMembers(from, to);
    });
    return slot;
  }

  // 单槽编辑弹窗：改英雄(按位置分组挑选) + 改所属成员
  function editSlot(idx) {
    var as = state.currentComp.assignments[idx];
    var members = state.members;
    var memberOpts = '<option value="">（待认领 / 空位）</option>' + members.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === as.memberId ? ' selected' : '') + '>' +
        esc(m.nickname) + (m.is_starter === false ? '（替补）' : '') + '</option>';
    }).join('');

    var agentPicker = D.ROLE_ORDER.map(function (role) {
      var cards = D.agentsByRole[role].map(function (a) {
        return '<div class="pick-agent' + (a.id === as.agentId ? ' on' : '') + '" data-aid="' + a.id + '" data-role="' + role + '" title="' + esc(a.cn) + '">' +
          img(A.agentThumb(a), a.cn) + '<span>' + esc(a.cn) + '</span></div>';
      }).join('');
      return '<div class="pick-role"><div class="role-header"><div class="bar bg-' + role + '"></div>' +
        '<h3 style="font-size:13px">' + roleCn(role) + '</h3></div><div class="pick-grid">' + cards + '</div></div>';
    }).join('');

    openModal('<span class="close" id="mClose">×</span><h3>修改位置 ' + (idx + 1) + '</h3>' +
      '<label style="display:block;font-size:13px;color:var(--text-1);margin:12px 0 6px">分配成员</label>' +
      '<select id="slotMember" class="text" style="width:100%">' + memberOpts + '</select>' +
      '<label style="display:block;font-size:13px;color:var(--text-1);margin:14px 0 6px">选择英雄（点击选中，位置随英雄自动归类）</label>' +
      '<div class="pick-wrap">' + agentPicker + '</div>' +
      '<div class="editor-actions"><button class="btn primary" id="slotSave">确定</button>' +
      '<button class="btn ghost" id="slotCancel">取消</button></div>');

    var chosen = { agentId: as.agentId, role: as.role };
    $('#mClose').addEventListener('click', closeModal);
    $('#slotCancel').addEventListener('click', closeModal);
    $all('#modalBox .pick-agent').forEach(function (c) {
      c.addEventListener('click', function () {
        $all('#modalBox .pick-agent').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        chosen.agentId = c.dataset.aid; chosen.role = c.dataset.role;
      });
    });
    $('#slotSave').addEventListener('click', function () {
      var mid = $('#slotMember').value;
      var m = members.filter(function (x) { return x.id === mid; })[0];
      as.agentId = chosen.agentId;
      as.role = chosen.role;
      as.memberId = m ? m.id : null;
      as.memberName = m ? m.nickname : '（待认领）';
      as.source = '手动编辑';
      closeModal();
      renderCompResult(state.currentComp);
      toast('已修改，记得点“保存到协作方案”');
    });
  }

  // 交换两个槽的“成员”(位置/英雄保持不变，人换) —— 手动微调用
  function swapAssignmentMembers(from, to) {
    var arr = state.currentComp.assignments;
    var a = arr[from], b = arr[to];
    var tmpName = a.memberName, tmpId = a.memberId;
    a.memberName = b.memberName; a.memberId = b.memberId; a.source = '手动调整';
    b.memberName = tmpName; b.memberId = tmpId; b.source = '手动调整';
    renderCompResult(state.currentComp);
    toast('已交换成员，别忘了保存');
  }

  $('#saveCompBtn').addEventListener('click', function () {
    if (!state.currentComp || !state.currentMapId) return;
    var actor = state.nick; if (!actor) { toast('请先在右上角填写你的昵称'); return; }
    var assignments = state.currentComp.assignments.map(function (as) {
      return { memberId: as.memberId, memberName: as.memberName, agentId: as.agentId, role: as.role };
    });
    S.saveComposition(state.room.id, state.currentMapId, assignments, actor)
      .then(function () { toast('已保存到协作方案，并记录日志'); refreshLogs(); })
      .catch(function (e) { toast('保存失败：' + (e.message || e)); });
  });

  $('#viewVersionsBtn').addEventListener('click', function () {
    if (!state.currentMapId) return;
    showVersions(state.currentMapId);
  });

  function showVersions(mapId) {
    var m = D.mapById[mapId];
    S.listVersions(state.room.id, mapId, 50).then(function (vs) {
      var html = '<span class="close" id="mClose">×</span><h3>历史版本 · ' + esc(m.cn) + '</h3>' +
        '<p style="color:var(--text-2);font-size:13px">每次保存都会存档，可点击回滚。</p>';
      if (!vs.length) html += '<div class="empty">该地图还没有保存过阵容。</div>';
      else html += vs.map(function (v, i) {
        var agentsCn = (v.assignments || []).map(function (x) {
          var a = D.agentById[x.agentId]; return (x.memberName || '空') + '·' + (a ? a.cn : x.agentId);
        }).join('，');
        return '<div class="card version-item" style="margin-bottom:8px"><div class="v-info">' +
          '<div class="v-time">' + S.formatTime(v.created_at) + (i === 0 ? ' <span style="color:var(--sentinel)">（最新）</span>' : '') + '</div>' +
          '<div class="v-agents">' + esc(agentsCn) + '</div>' +
          '<div class="v-agents">保存人：' + esc(v.saved_by || '匿名') + '</div></div>' +
          '<button class="btn ghost small" data-vi="' + i + '">回滚</button></div>';
      }).join('');
      openModal(html);
      $('#mClose').addEventListener('click', closeModal);
      $all('#modalBox [data-vi]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var v = vs[parseInt(btn.dataset.vi, 10)];
          var actor = state.nick || '匿名';
          S.rollbackVersion(state.room.id, mapId, v, actor).then(function () {
            closeModal(); toast('已回滚到该版本'); refreshLogs();
            // 重新生成显示当前地图
            if (state.currentMapId === mapId) {
              $('#compMapSelect').value = mapId;
              state.currentComp = { assignments: v.assignments.map(function (x) {
                return { memberId: x.memberId, memberName: x.memberName, agentId: x.agentId, role: x.role, source: '历史版本' }; }),
                template: (D.comps[mapId] || [])[0] };
              renderCompResult(state.currentComp);
            }
          }).catch(function (e) { toast('回滚失败：' + (e.message || e)); });
        });
      });
    });
  }

  // =================================================================
  // AI（DeepSeek）：分析阵容 / 练习建议 + 设置
  // =================================================================
  function requireCompForAI() {
    if (!state.currentComp || !state.currentComp.assignments || !state.currentComp.assignments.length) {
      toast('请先生成或读取一套阵容'); return false;
    }
    if (!VCT.ai.hasKey()) { toast('尚未配置 AI 密钥，正在打开设置…'); openSettings(); return false; }
    return true;
  }

  function runAI(kind) {
    if (!requireCompForAI()) return;
    var title = kind === 'analyze' ? 'AI 阵容分析' : 'AI 练习建议';
    openModal('<span class="close" id="mClose">×</span><h3>' + title + '</h3>' +
      '<div id="aiOut" class="ai-out"><div class="ai-loading">🤖 正在思考中…（DeepSeek）</div></div>');
    $('#mClose').addEventListener('click', closeModal);

    var call = kind === 'analyze'
      ? VCT.ai.analyzeComp(state.currentMapId, state.currentComp.assignments)
      : VCT.ai.practiceAdvice(state.currentMapId, state.currentComp.assignments);

    call.then(function (text) {
      var out = $('#aiOut'); if (!out) return; // 弹窗可能已关
      out.innerHTML = renderAIText(text);
      // 仅记录“做了AI分析”动作，绝不写入密钥或返回原文
      S.addLog(state.room.id, {
        map_id: state.currentMapId, actor: state.nick || '匿名',
        action: kind === 'analyze' ? 'AI分析阵容' : 'AI练习建议',
        change_type: 'edit', target: '阵容:' + ((D.mapById[state.currentMapId] || {}).cn || state.currentMapId),
        detail: (D.mapById[state.currentMapId] || {}).cn || state.currentMapId
      });
    }).catch(function (e) {
      var out = $('#aiOut'); if (out) out.innerHTML = '<div class="ai-err">' + esc(VCT.ai.friendlyError(e)) + '</div>';
    });
  }

  // 极简 Markdown 渲染(仅换行/加粗)，避免引第三方库
  function renderAIText(text) {
    var safe = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br/>');
    return '<div class="ai-md">' + safe + '</div>';
  }

  $('#aiAnalyzeBtn').addEventListener('click', function () { runAI('analyze'); });
  $('#aiPracticeBtn').addEventListener('click', function () { runAI('practice'); });

  // ---------- 设置弹窗(AI 密钥) ----------
  function openSettings() {
    var masked = VCT.ai.getKeyMasked();
    openModal('<span class="close" id="mClose">×</span><h3>设置</h3>' +
      '<label style="display:block;font-size:13px;color:var(--text-1);margin:12px 0 6px">DeepSeek API 密钥</label>' +
      '<input class="text" id="aiKeyInput" type="password" placeholder="' + (masked || 'sk-...') + '" style="width:100%"/>' +
      '<p style="font-size:12px;color:var(--text-2);margin:8px 0 0;line-height:1.7">' +
        '· 到 <b>platform.deepseek.com</b> → API Keys 创建密钥后粘贴到这里。<br/>' +
        '· 密钥<b>只保存在你本机浏览器(localStorage)</b>，不会上传服务器、不进代码仓库、不写入编辑日志。<br/>' +
        '· 仅用于本机直接调用官方 DeepSeek 接口做阵容分析/练习建议。</p>' +
      '<div style="font-size:12px;color:var(--text-2);margin-top:8px">当前状态：' +
        (masked ? ('已配置 <b>' + esc(masked) + '</b>') : '未配置') + '</div>' +
      '<div class="editor-actions"><button class="btn primary" id="aiKeySave">保存密钥</button>' +
      (masked ? '<button class="btn ghost" id="aiKeyClear">清除密钥</button>' : '') +
      '<button class="btn ghost" id="aiKeyCancel">关闭</button></div>');
    $('#mClose').addEventListener('click', closeModal);
    $('#aiKeyCancel').addEventListener('click', closeModal);
    $('#aiKeySave').addEventListener('click', function () {
      var v = $('#aiKeyInput').value.trim();
      if (!v) { toast('请输入密钥，或点清除'); return; }
      VCT.ai.setKey(v); closeModal(); toast('密钥已保存到本机');
    });
    var clr = $('#aiKeyClear');
    if (clr) clr.addEventListener('click', function () { VCT.ai.setKey(''); closeModal(); toast('已清除本机密钥'); });
  }
  $('#settingsBtn').addEventListener('click', openSettings);

  // =================================================================
  // 编辑日志
  // =================================================================
  function refreshLogs() {
    if (!state.room) return;
    S.listLogs(state.room.id, 300).then(function (logs) {
      state.logs = logs;
      renderLogs();
    });
  }

  // 修改类型 → 中文标签 + 样式类
  var CHANGE_TYPE_CN = { add: '新增', edit: '编辑', delete: '删除' };

  function renderLogs() {
    var box = $('#logList'); if (!box) return;
    var logs = state.logs || [];
    var kw = ($('#logSearch') && $('#logSearch').value || '').trim().toLowerCase();
    var typeF = ($('#logTypeFilter') && $('#logTypeFilter').value) || '';

    var filtered = logs.filter(function (l) {
      if (typeF && (l.change_type || 'edit') !== typeF) return false;
      if (kw) {
        var hay = ((l.actor || '') + ' ' + (l.action || '') + ' ' + (l.detail || '') + ' ' + (l.target || '')).toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });

    var cntEl = $('#logCount');
    if (cntEl) cntEl.textContent = '共 ' + filtered.length + ' 条' + (logs.length !== filtered.length ? '（总 ' + logs.length + '）' : '');

    box.innerHTML = '';
    if (!filtered.length) {
      box.appendChild(el('div', 'empty', logs.length ? '没有符合条件的日志。' : '暂无日志。团队开始编辑后这里会记录每一次改动。'));
      return;
    }
    filtered.forEach(function (l) {
      var ct = l.change_type || 'edit';
      var ctCn = CHANGE_TYPE_CN[ct] || ct;
      // 修改内容对比
      var diffHtml = '';
      var changes = l.diff && l.diff.changes;
      if (changes && changes.length) {
        diffHtml = '<div class="l-diff">' + changes.map(function (c) {
          return '<div class="l-change"><span class="l-slot">' + esc(String(c.slot)) + '</span>' +
            '<span class="l-from">' + esc(String(c.from)) + '</span>' +
            '<span class="l-arrow">→</span>' +
            '<span class="l-to">' + esc(String(c.to)) + '</span></div>';
        }).join('') + '</div>';
      }
      var item = el('div', 'card log-item');
      item.innerHTML =
        '<div class="dot ct-' + ct + '"></div><div class="l-body">' +
        '<div class="l-top"><span class="l-actor">' + esc(l.actor) + '</span>' +
        '<span class="l-ct ct-' + ct + '">' + esc(ctCn) + '</span>' +
        '<span class="l-action">' + esc(l.action) + '</span>' +
        (l.target ? '<span class="l-target">' + esc(l.target) + '</span>' : '') +
        '<span class="l-time">' + S.formatTime(l.created_at) + '</span></div>' +
        '<div class="l-detail">' + esc(l.detail || '') + '</div>' + diffHtml + '</div>';
      box.appendChild(item);
    });
  }

  // 日志筛选交互
  (function bindLogFilters() {
    var s = $('#logSearch'), t = $('#logTypeFilter'), r = $('#logRefreshBtn');
    if (s) s.addEventListener('input', renderLogs);
    if (t) t.addEventListener('change', renderLogs);
    if (r) r.addEventListener('click', refreshLogs);
  })();

  // =================================================================
  // 实时协作订阅
  // =================================================================
  function subscribeRealtime() {
    if (!state.room) return;
    S.subscribe('members', state.room.id, function () { refreshMembers(); });
    S.subscribe('edit_logs', state.room.id, function () {
      if ($('#view-logs').classList.contains('active')) refreshLogs();
    });
    S.subscribe('compositions', state.room.id, function () {
      if (S.isCloud) toast('协作方案有更新');
    });
  }

  // 启动
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
