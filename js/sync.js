/*
 * sync.js —— 与 valorant-api.com 的地图/英雄元数据同步
 * -----------------------------------------------------------------
 * 目标：让“地图池 / 英雄名单”能随游戏版本动态更新，而无需每次改代码重发版。
 *
 * 关于「API 是否会自动更新地图点位」——重要结论（已实测确认）：
 *   ✅ valorant-api.com 会随官方版本更新：英雄列表、地图列表、名称、素材图(全景图/小地图/头像)、
 *      以及地图的 callouts(区域名，如 A Tree / B Main) 与坐标映射(xMultiplier 等)。
 *   ❌ 但 API **不提供**“职业道具投掷点位/lineup”这类数据——它没有这种字段。
 *      因此本工具的 lineups(点位) 属于**本项目自维护数据**(maps.js 里手工标注)，
 *      不会、也无法由 API 自动更新。
 *
 * 于是同步机制设计为「分层」：
 *   - 元数据层(名称/素材/uuid/新图是否进池)：可由本模块运行时从 API 拉取并合并，保持最新。
 *   - 点位层(lineups)：由 maps.js 本地维护；API 同步只“新增空点位地图占位”，绝不覆盖已有点位。
 *
 * 同步是**可选增强**：不联网 / 同步失败 时，一切照常用内置数据(maps.js/agents.js)。
 * 结果缓存在 localStorage(带时间戳)，默认 24h 内不重复请求，避免拖慢启动。
 */
(function () {
  window.VCT = window.VCT || {};
  var D = VCT.data;

  var BASE = 'https://valorant-api.com/v1';
  var CACHE_KEY = 'vct_api_sync_cache_v1';
  var TTL_MS = 24 * 60 * 60 * 1000; // 24 小时

  // API 的位置英文名 → 本项目 role key
  var ROLE_MAP = { Duelist: 'duelist', Initiator: 'initiator', Controller: 'controller', Sentinel: 'sentinel' };

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null; } catch (e) { return null; }
  }
  function writeCache(obj) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function fetchJson(url) {
    return fetch(url, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return j.data; });
  }

  // 生成 id：英文名转小写去特殊字符（与内置数据风格一致）
  function toId(en) { return String(en).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // 合并英雄：新增 API 里有但本地没有的英雄；更新已有英雄的 uuid/cn(若缺)
  function mergeAgents(apiAgents) {
    var report = { added: [], total: 0 };
    var existByUuid = {};
    D.agents.forEach(function (a) { existByUuid[a.uuid] = a; });

    apiAgents.forEach(function (a) {
      if (!a.isPlayableCharacter || !a.role) return;
      var role = ROLE_MAP[a.role.displayName];
      if (!role) return;
      var found = existByUuid[a.uuid];
      if (found) {
        // 已有：补齐素材直链(可选)，不改动 id/cn 以免影响已保存数据
        found.icon = a.displayIcon || found.icon;
        found.portrait = a.fullPortrait || found.portrait;
      } else {
        // 新英雄：加入名单(cn 暂用英文名，等本地补中文)
        var na = { id: toId(a.displayName), en: a.displayName, cn: a.displayName, role: role,
                   uuid: a.uuid, icon: a.displayIcon, portrait: a.fullPortrait, _fromApi: true };
        // 避免 id 冲突
        if (D.agentById[na.id]) na.id = na.id + '_' + a.uuid.slice(0, 4);
        D.agents.push(na);
        D.agentById[na.id] = na;
        D.agentByEn[na.en.toLowerCase()] = na;
        D.agentsByRole[role].push(na);
        report.added.push(na.en);
      }
    });
    report.total = D.agents.length;
    return report;
  }

  // 合并地图：只处理“在 RANKED_POOL 里”的地图。
  // 已有地图：更新素材直链；池内但本地缺失的新图：加入(空 lineups，占位)。
  function mergeMaps(apiMaps) {
    var report = { added: [], pool: (D.RANKED_POOL || []).slice(), total: 0 };
    var pool = {};
    (D.RANKED_POOL || []).forEach(function (en) { pool[en] = true; });
    var existByUuid = {};
    D.maps.forEach(function (m) { existByUuid[m.uuid] = m; });

    apiMaps.forEach(function (m) {
      if (!pool[m.displayName]) return;        // 不在排位池，跳过
      if (!m.splash || !m.displayIcon) return; // 无有效素材(如训练场)，跳过
      var found = existByUuid[m.uuid];
      if (found) {
        found.splash = m.splash;               // 更新素材直链
        found.minimap = m.displayIcon;
        found.thumb = m.listViewIcon || found.thumb;
      } else {
        // 池内新图：本地还没有 → 加入占位(lineups 为空，待本地补点位)
        var nm = { id: toId(m.displayName), en: m.displayName, cn: m.displayName,
                   sites: 2, uuid: m.uuid, summary: '（新地图，点位数据待补充）',
                   splash: m.splash, minimap: m.displayIcon, thumb: m.listViewIcon,
                   lineups: [], _fromApi: true };
        if (D.mapById[nm.id]) nm.id = nm.id + '_' + m.uuid.slice(0, 4);
        D.maps.push(nm);
        D.mapById[nm.id] = nm;
        report.added.push(nm.en);
      }
    });
    report.total = D.maps.length;
    return report;
  }

  // 主入口：force=true 忽略缓存。返回同步报告 Promise（永不 reject，失败也 resolve）
  function run(opts) {
    opts = opts || {};
    var cache = readCache();
    var fresh = cache && (Date.now() - cache.ts < TTL_MS);
    if (fresh && !opts.force) {
      // 用缓存数据合并(离线也能享受上次同步结果)
      try {
        var r1 = mergeAgents(cache.agents || []);
        var r2 = mergeMaps(cache.maps || []);
        return Promise.resolve({ ok: true, fromCache: true, agents: r1, maps: r2, ts: cache.ts });
      } catch (e) { /* 缓存损坏则重新拉 */ }
    }
    return Promise.all([
      fetchJson(BASE + '/agents?isPlayableCharacter=true'),
      fetchJson(BASE + '/maps'),
      fetchJson(BASE + '/version').catch(function () { return null; })
    ]).then(function (arr) {
      var apiAgents = arr[0], apiMaps = arr[1], version = arr[2];
      writeCache({ ts: Date.now(), agents: apiAgents, maps: apiMaps, version: version });
      var r1 = mergeAgents(apiAgents);
      var r2 = mergeMaps(apiMaps);
      return { ok: true, fromCache: false, agents: r1, maps: r2,
               version: version ? version.version : null, ts: Date.now() };
    }).catch(function (e) {
      return { ok: false, error: e.message || String(e) };
    });
  }

  VCT.sync = {
    run: run,
    lastSyncTime: function () { var c = readCache(); return c ? c.ts : null; },
    clearCache: function () { try { localStorage.removeItem(CACHE_KEY); } catch (e) {} }
  };
})();
