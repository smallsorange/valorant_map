/*
 * store.js —— 数据存储与协作层
 * -----------------------------------------------------------------
 * 统一封装“云端(Supabase) / 本地(localStorage)”两种后端，对上层 UI 暴露一致的 API：
 *   - 房间 / 成员英雄池 的读写
 *   - 阵容方案的读写 + 实时订阅
 *   - 编辑日志(谁在何时改了什么) 的写入与读取
 *   - 历史版本快照的保存 / 列出 / 回滚
 *
 * 若 config.js 填了 Supabase URL/Key，则走云端(支持最多5人实时协作)；
 * 否则自动降级为本地模式(localStorage，单机可用)。
 */
(function () {
  window.VCT = window.VCT || {};

  var cfg = (VCT.SUPABASE_CONFIG || {});
  var useCloud = !!(cfg.url && cfg.anonKey && window.supabase);
  var sb = useCloud ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;

  var LS_KEY = 'vct_comp_tool_local_v1';

  // ---------- 本地存储辅助 ----------
  function lsRead() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function lsWrite(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  function lsDefaultRoom(db) {
    if (!db.rooms) db.rooms = [];
    if (!db.members) db.members = [];
    if (!db.compositions) db.compositions = [];
    if (!db.edit_logs) db.edit_logs = [];
    if (!db.comp_versions) db.comp_versions = [];
    if (db.rooms.length === 0) {
      db.rooms.push({ id: 'local-room', name: '本地团队房间', created_at: new Date().toISOString() });
    }
    return db;
  }
  function uid() { return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

  // 本地模式下用于模拟“实时”：同标签页内的订阅回调
  var localSubs = { compositions: [], members: [], edit_logs: [] };
  function emitLocal(kind) {
    (localSubs[kind] || []).forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  var Store = {
    mode: useCloud ? 'cloud' : 'local',
    isCloud: useCloud,

    // ============ 房间 ============
    // 获取(或创建)默认协作房间，返回 room 对象
    getOrCreateRoom: function (roomName) {
      if (useCloud) {
        return sb.from('rooms').select('*').order('created_at', { ascending: true }).limit(1)
          .then(function (res) {
            if (res.error) throw res.error;
            if (res.data && res.data.length) return res.data[0];
            return sb.from('rooms').insert({ name: roomName || '团队房间' }).select().single()
              .then(function (r) { if (r.error) throw r.error; return r.data; });
          });
      }
      var db = lsDefaultRoom(lsRead()); lsWrite(db);
      return Promise.resolve(db.rooms[0]);
    },

    // ============ 成员英雄池 ============
    listMembers: function (roomId) {
      if (useCloud) {
        return sb.from('members').select('*').eq('room_id', roomId).order('updated_at', { ascending: true })
          .then(function (res) { if (res.error) throw res.error; return res.data || []; });
      }
      var db = lsDefaultRoom(lsRead());
      return Promise.resolve(db.members.filter(function (m) { return m.room_id === roomId; }));
    },

    upsertMember: function (roomId, member) {
      // member: { id?, nickname, roles:[], agents:[], is_starter?, sort_order? }
      var row = {
        room_id: roomId, nickname: member.nickname,
        roles: member.roles || [], agents: member.agents || [],
        updated_at: new Date().toISOString()
      };
      if (typeof member.is_starter === 'boolean') row.is_starter = member.is_starter;
      if (typeof member.sort_order === 'number') row.sort_order = member.sort_order;
      if (useCloud) {
        var q = member.id
          ? sb.from('members').update(row).eq('id', member.id).select().single()
          : sb.from('members').insert(row).select().single();
        return q.then(function (r) { if (r.error) throw r.error; return r.data; });
      }
      var db = lsDefaultRoom(lsRead());
      if (member.id) {
        var idx = db.members.findIndex(function (m) { return m.id === member.id; });
        if (idx >= 0) db.members[idx] = Object.assign({}, db.members[idx], row);
      } else {
        // 新成员默认首发(若首发未满5人)否则替补
        if (typeof row.is_starter !== 'boolean') {
          var starters = db.members.filter(function (m) { return m.room_id === roomId && m.is_starter !== false; }).length;
          row.is_starter = starters < 5;
        }
        row.id = uid(); db.members.push(row);
      }
      lsWrite(db); emitLocal('members');
      return Promise.resolve(row);
    },

    // 设置某成员的首发/替补分组(仅改分组，不动其它字段)
    setMemberGroup: function (memberId, isStarter) {
      if (useCloud) {
        return sb.from('members').update({ is_starter: isStarter, updated_at: new Date().toISOString() })
          .eq('id', memberId).select().single()
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      }
      var db = lsDefaultRoom(lsRead());
      var idx = db.members.findIndex(function (m) { return m.id === memberId; });
      if (idx >= 0) { db.members[idx].is_starter = isStarter; lsWrite(db); emitLocal('members'); }
      return Promise.resolve(db.members[idx]);
    },

    deleteMember: function (memberId) {
      if (useCloud) {
        return sb.from('members').delete().eq('id', memberId)
          .then(function (r) { if (r.error) throw r.error; });
      }
      var db = lsDefaultRoom(lsRead());
      db.members = db.members.filter(function (m) { return m.id !== memberId; });
      lsWrite(db); emitLocal('members');
      return Promise.resolve();
    },

    // ============ 阵容方案(当前状态) ============
    listCompositions: function (roomId) {
      if (useCloud) {
        return sb.from('compositions').select('*').eq('room_id', roomId)
          .then(function (res) { if (res.error) throw res.error; return res.data || []; });
      }
      var db = lsDefaultRoom(lsRead());
      return Promise.resolve(db.compositions.filter(function (c) { return c.room_id === roomId; }));
    },

    getComposition: function (roomId, mapId) {
      return this.listCompositions(roomId).then(function (list) {
        return list.filter(function (c) { return c.map_id === mapId; })[0] || null;
      });
    },

    // 保存阵容：更新当前状态 + 写一份历史快照 + 写带对比的编辑日志
    saveComposition: function (roomId, mapId, assignments, actor) {
      var self = this;
      var nowIso = new Date().toISOString();
      assignments = assignments || [];
      var row = {
        room_id: roomId, map_id: mapId,
        assignments: assignments, updated_by: actor, updated_at: nowIso
      };
      // 先取旧状态，用于生成“修改对比”与判断新增/编辑
      return self.getComposition(roomId, mapId).then(function (prev) {
        var prevAssignments = prev && prev.assignments ? prev.assignments : [];
        var isNew = !prev;
        var diff = buildCompDiff(prevAssignments, assignments);
        var logEntry = {
          map_id: mapId, actor: actor,
          action: isNew ? '创建阵容' : '更新阵容',
          change_type: isNew ? 'add' : 'edit',
          target: '阵容:' + ((VCT.data.mapById[mapId] || {}).cn || mapId),
          detail: describeAssignments(mapId, assignments),
          diff: diff
        };

        if (useCloud) {
          return sb.from('compositions').upsert(row, { onConflict: 'room_id,map_id' }).select().single()
            .then(function (r) {
              if (r.error) throw r.error;
              return sb.from('comp_versions').insert({
                room_id: roomId, map_id: mapId, assignments: assignments, saved_by: actor
              }).then(function () { return r.data; });
            })
            .then(function (data) {
              return self.addLog(roomId, logEntry).then(function () { return data; });
            });
        }
        var db = lsDefaultRoom(lsRead());
        var idx = db.compositions.findIndex(function (c) { return c.room_id === roomId && c.map_id === mapId; });
        if (idx >= 0) db.compositions[idx] = Object.assign({}, db.compositions[idx], row);
        else { row.id = uid(); db.compositions.push(row); }
        db.comp_versions.push({
          id: Date.now(), room_id: roomId, map_id: mapId,
          assignments: assignments, saved_by: actor, created_at: nowIso
        });
        lsWrite(db); emitLocal('compositions');
        return self.addLog(roomId, logEntry).then(function () { return row; });
      });
    },

    // ============ 编辑日志 ============
    // log: { map_id?, actor, action, change_type?(add/edit/delete), target?, detail?, diff?, payload? }
    // 兼容策略：结构化信息(change_type/target/diff)同时写入专用列 + payload._meta。
    // 这样即使数据库还没跑迁移(缺专用列)，也能把它们存进已存在的 payload 列，读时再还原。
    addLog: function (roomId, log) {
      var meta = {
        change_type: log.change_type || 'edit',
        target: log.target || null,
        diff: log.diff || null
      };
      var payload = Object.assign({}, log.payload || {}, { _meta: meta });
      var full = {
        room_id: roomId, map_id: log.map_id || null,
        actor: log.actor || '匿名', action: log.action || '编辑',
        change_type: meta.change_type, target: meta.target, detail: log.detail || '',
        diff: meta.diff, payload: payload
      };
      var basic = {
        room_id: full.room_id, map_id: full.map_id, actor: full.actor,
        action: full.action, detail: full.detail, payload: payload  // payload 里带 _meta，信息不丢
      };
      if (useCloud) {
        return sb.from('edit_logs').insert(full).then(function (r) {
          if (!r.error) return;
          // 缺专用列(未跑迁移) → 降级为基础字段，但 payload 已含全部结构化信息
          var msg = (r.error.message || '') + (r.error.code || '');
          if (/change_type|target|diff|PGRST204/i.test(msg)) {
            return sb.from('edit_logs').insert(basic).then(function (r2) { if (r2.error) throw r2.error; });
          }
          throw r.error;
        });
      }
      var db = lsDefaultRoom(lsRead());
      full.id = Date.now() + Math.floor(Math.random() * 1000);
      full.created_at = new Date().toISOString();
      db.edit_logs.push(full);
      lsWrite(db); emitLocal('edit_logs');
      return Promise.resolve();
    },

    // 从 payload._meta 还原结构化字段(兼容未跑迁移的旧行)
    _hydrateLog: function (l) {
      var meta = l.payload && l.payload._meta;
      if (meta) {
        if (l.change_type == null) l.change_type = meta.change_type;
        if (l.target == null) l.target = meta.target;
        if (l.diff == null) l.diff = meta.diff;
      }
      if (l.change_type == null) l.change_type = 'edit';
      return l;
    },

    listLogs: function (roomId, limit) {
      limit = limit || 100;
      var self = this;
      if (useCloud) {
        return sb.from('edit_logs').select('*').eq('room_id', roomId)
          .order('created_at', { ascending: false }).limit(limit)
          .then(function (res) { if (res.error) throw res.error; return (res.data || []).map(function (l) { return self._hydrateLog(l); }); });
      }
      var db = lsDefaultRoom(lsRead());
      var logs = db.edit_logs.filter(function (l) { return l.room_id === roomId; })
        .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
      return Promise.resolve(logs.slice(0, limit).map(function (l) { return self._hydrateLog(l); }));
    },

    // ============ 历史版本 ============
    listVersions: function (roomId, mapId, limit) {
      limit = limit || 50;
      if (useCloud) {
        return sb.from('comp_versions').select('*').eq('room_id', roomId).eq('map_id', mapId)
          .order('created_at', { ascending: false }).limit(limit)
          .then(function (res) { if (res.error) throw res.error; return res.data || []; });
      }
      var db = lsDefaultRoom(lsRead());
      var vs = db.comp_versions.filter(function (v) { return v.room_id === roomId && v.map_id === mapId; })
        .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
      return Promise.resolve(vs.slice(0, limit));
    },

    // 回滚到某个历史版本 = 用该快照重新保存(会再生成一条新版本 + 日志)
    rollbackVersion: function (roomId, mapId, version, actor) {
      var self = this;
      return this.saveComposition(roomId, mapId, version.assignments, actor).then(function (data) {
        return self.addLog(roomId, {
          map_id: mapId, actor: actor, action: '回滚版本',
          detail: '回滚到 ' + formatTime(version.created_at) + ' 的历史版本'
        }).then(function () { return data; });
      });
    },

    // ============ 实时订阅 ============
    // kind: 'compositions' | 'members' | 'edit_logs'；回调无参数，收到变更即触发
    subscribe: function (kind, roomId, cb) {
      if (useCloud) {
        var ch = sb.channel('rt-' + kind + '-' + Math.random().toString(36).slice(2))
          .on('postgres_changes',
            { event: '*', schema: 'public', table: kind, filter: 'room_id=eq.' + roomId },
            function () { cb(); })
          .subscribe();
        return function () { sb.removeChannel(ch); };
      }
      localSubs[kind] = localSubs[kind] || [];
      localSubs[kind].push(cb);
      return function () {
        localSubs[kind] = localSubs[kind].filter(function (f) { return f !== cb; });
      };
    }
  };

  // 生成阵容变更的可读描述，用于编辑日志
  function describeAssignments(mapId, assignments) {
    var map = VCT.data.mapById[mapId];
    var mapName = map ? map.cn : mapId;
    if (!assignments || !assignments.length) return mapName + '：清空阵容';
    var parts = assignments.map(function (a) {
      var agent = VCT.data.agentById[a.agentId];
      return (a.memberName || '空位') + '→' + (agent ? agent.cn : a.agentId);
    });
    return mapName + '：' + parts.join('，');
  }

  // 计算阵容的“前→后”对比，用于日志的修改内容对比。
  // 按位置(role顺序)逐槽比较英雄与使用者，输出 { before, after, changes }。
  function buildCompDiff(before, after) {
    function label(a) {
      if (!a) return '（空）';
      var agent = VCT.data.agentById[a.agentId];
      var roleCn = (VCT.data.ROLES[a.role] || {}).cn || a.role || '';
      return (agent ? agent.cn : (a.agentId || '?')) + '/' + (a.memberName || '待认领') + (roleCn ? '(' + roleCn + ')' : '');
    }
    var beforeArr = (before || []).map(label);
    var afterArr = (after || []).map(label);
    var changes = [];
    var n = Math.max(beforeArr.length, afterArr.length);
    for (var i = 0; i < n; i++) {
      var b = beforeArr[i], a = afterArr[i];
      if (b !== a) {
        changes.push({ slot: i + 1, from: b || '（空）', to: a || '（空）' });
      }
    }
    return { before: beforeArr, after: afterArr, changes: changes };
  }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes());
  }

  Store.formatTime = formatTime;
  VCT.store = Store;
})();
