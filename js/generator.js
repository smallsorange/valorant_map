/*
 * generator.js —— 智能阵容生成
 * -----------------------------------------------------------------
 * 输入：某张地图 + 团队成员英雄池(每人擅长位置 + 擅长英雄)
 * 输出：一套 5 人阵容分配 [{memberId, memberName, agentId, role, source}]
 *
 * 算法思路(以 VCT 经典强势阵容为基准，结合队员英雄池做适配)：
 *   1. 取该地图的经典模板(comps.js)，得到 5 个“目标英雄槽”。
 *   2. 对每个目标英雄，做带优先级的匹配：
 *        a) 有队员正好会这个英雄 → 直接分配(最佳)
 *        b) 没人会该英雄，但有队员擅长该英雄的“位置” → 用该队员会的、同位置英雄替补
 *        c) 仍无法满足 → 标记为“建议补位”，提示需要有人学习该位置
 *   3. 每位队员最多只占一个槽；优先把“稀缺英雄/位置”分给唯一会的人(贪心避免冲突)。
 *   4. 输出附带 source 说明(精确匹配 / 同位置替补 / 建议补位)，便于团队理解。
 *
 * 注：这是启发式推荐，非唯一解；团队可在生成后手动拖拽微调。
 */
(function () {
  window.VCT = window.VCT || {};
  var data = VCT.data;

  function agent(id) { return data.agentById[id]; }

  // 计算某英雄在队员中的“可得人数”，用于稀缺度排序
  function countCandidates(members, agentId) {
    return members.filter(function (m) { return (m.agents || []).indexOf(agentId) >= 0; }).length;
  }

  // 主入口
  function generate(mapId, members) {
    // 优先只用“首发”成员(is_starter !== false)；若没有任何首发标记，则用全部
    var allMembers = members || [];
    var starters = allMembers.filter(function (m) { return m.is_starter !== false; });
    members = starters.length ? starters : allMembers;

    var templates = (data.comps[mapId] || []);
    var template = templates[0]; // 采用该地图首选经典模板
    var result = { mapId: mapId, template: template, assignments: [], notes: [] };

    if (!template) {
      result.notes.push('该地图暂无内置模板，将按位置均衡分配。');
      return fallbackByRole(mapId, members, result);
    }
    if (!members || !members.length) {
      result.notes.push('还没有团队成员英雄池，先在「英雄池」里添加成员。');
      // 直接返回模板本身作为“参考阵容”
      result.assignments = template.agents.map(function (aid) {
        var ag = agent(aid);
        return { memberId: null, memberName: '（待认领）', agentId: aid, role: ag.role, source: '模板参考' };
      });
      return result;
    }

    var usedMembers = {};   // memberId -> true
    var slots = template.agents.slice();

    // 按“稀缺度”排序目标槽：越少人会的英雄越先分配，避免被抢占
    slots.sort(function (a, b) {
      return countCandidates(members, a) - countCandidates(members, b);
    });

    slots.forEach(function (targetAgentId) {
      var targetAgent = agent(targetAgentId);
      var targetRole = targetAgent.role;

      // a) 精确匹配：有人会这个英雄且未被占用
      var exact = members.filter(function (m) {
        return !usedMembers[m.id] && (m.agents || []).indexOf(targetAgentId) >= 0;
      });
      // 精确匹配里，优先选“英雄池更窄”的人(把灵活的人留给后面)
      exact.sort(function (a, b) { return (a.agents || []).length - (b.agents || []).length; });
      if (exact.length) {
        var mA = exact[0]; usedMembers[mA.id] = true;
        result.assignments.push({
          memberId: mA.id, memberName: mA.nickname, agentId: targetAgentId,
          role: targetRole, source: '精确匹配'
        });
        return;
      }

      // b) 同位置替补：有人擅长该位置(位置列表包含 targetRole，或会该位置的其他英雄)
      var sameRole = members.filter(function (m) {
        if (usedMembers[m.id]) return false;
        var likesRole = (m.roles || []).indexOf(targetRole) >= 0;
        var hasRoleAgent = (m.agents || []).some(function (aid) {
          return agent(aid) && agent(aid).role === targetRole;
        });
        return likesRole || hasRoleAgent;
      });
      if (sameRole.length) {
        var mB = sameRole[0]; usedMembers[mB.id] = true;
        // 该队员会的、同位置英雄里挑一个(优先其英雄池里的同位置英雄，否则用目标英雄)
        var subAgent = (mB.agents || []).filter(function (aid) {
          return agent(aid) && agent(aid).role === targetRole;
        })[0] || targetAgentId;
        result.assignments.push({
          memberId: mB.id, memberName: mB.nickname, agentId: subAgent,
          role: targetRole, source: subAgent === targetAgentId ? '同位置(建议学习该英雄)' : '同位置替补'
        });
        return;
      }

      // c) 无法满足 → 建议补位
      result.assignments.push({
        memberId: null, memberName: '（待补位）', agentId: targetAgentId,
        role: targetRole, source: '建议补位'
      });
      result.notes.push('位置「' + data.ROLES[targetRole].cn + '」缺人，建议有队员练习 ' + targetAgent.cn + '。');
    });

    // 把未分配到的成员列出来(替补/轮换)
    var bench = members.filter(function (m) { return !usedMembers[m.id]; });
    if (bench.length) {
      result.bench = bench.map(function (m) { return m.nickname; });
      result.notes.push('替补/轮换成员：' + result.bench.join('、') + '（可手动拖拽替换首发）。');
    }

    // 按位置顺序排列输出，便于阅读
    result.assignments.sort(function (a, b) {
      return data.ROLE_ORDER.indexOf(a.role) - data.ROLE_ORDER.indexOf(b.role);
    });
    return result;
  }

  // 无模板时的兜底：按四大位置均衡分配
  function fallbackByRole(mapId, members, result) {
    var need = ['duelist', 'initiator', 'controller', 'sentinel', 'duelist'];
    var used = {};
    need.forEach(function (role) {
      var cand = (members || []).filter(function (m) {
        return !used[m.id] && ((m.roles || []).indexOf(role) >= 0 ||
          (m.agents || []).some(function (aid) { return data.agentById[aid] && data.agentById[aid].role === role; }));
      });
      if (cand.length) {
        var m = cand[0]; used[m.id] = true;
        var aid = (m.agents || []).filter(function (x) { return data.agentById[x].role === role; })[0]
          || data.agentsByRole[role][0].id;
        result.assignments.push({ memberId: m.id, memberName: m.nickname, agentId: aid, role: role, source: '位置均衡' });
      } else {
        var def = data.agentsByRole[role][0];
        result.assignments.push({ memberId: null, memberName: '（待补位）', agentId: def.id, role: role, source: '建议补位' });
      }
    });
    return result;
  }

  VCT.generator = { generate: generate };
})();
