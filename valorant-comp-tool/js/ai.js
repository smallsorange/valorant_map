/*
 * ai.js —— DeepSeek AI 集成（阵容分析 + 练习建议）
 * -----------------------------------------------------------------
 * 安全设计（重点）：
 *   - API 密钥**只存浏览器 localStorage**（键名 vct_deepseek_key），**绝不**写入代码、
 *     不提交仓库、不写入 Supabase、不写入编辑日志。日志里只记录“调用了AI分析”这类动作，
 *     不含密钥、不含请求原文。
 *   - 密钥仅在本机内存里用于拼 Authorization 头，发往官方 https://api.deepseek.com。
 *   - 提供“清除密钥”入口。用户在设置弹窗里自行填写（README 也会说明填写位置）。
 *
 * 稳定性：
 *   - 30s 超时(AbortController)、429/5xx 友好提示、网络失败兜底。
 *   - 简单限流：两次调用间隔 <3s 直接拒绝；单次调用进行中禁止再次发起。
 *
 * DeepSeek 兼容 OpenAI Chat Completions 协议，且允许浏览器跨域(CORS)直连，
 * 因此纯前端可直接调用，无需自建后端。
 */
(function () {
  window.VCT = window.VCT || {};

  var KEY_LS = 'vct_deepseek_key';
  var ENDPOINT = 'https://api.deepseek.com/chat/completions';
  var MODEL = 'deepseek-chat';
  var MIN_INTERVAL = 3000; // 限流：两次请求最小间隔
  var TIMEOUT = 30000;

  var lastCallAt = 0;
  var inFlight = false;

  function getKey() { try { return localStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { k ? localStorage.setItem(KEY_LS, k) : localStorage.removeItem(KEY_LS); } catch (e) {} }
  function hasKey() { return !!getKey(); }

  // 核心请求：messages 为 OpenAI 格式。返回 assistant 文本。
  function chat(messages) {
    var key = getKey();
    if (!key) return Promise.reject(new Error('NO_KEY'));
    if (inFlight) return Promise.reject(new Error('BUSY'));
    var now = Date.now();
    if (now - lastCallAt < MIN_INTERVAL) return Promise.reject(new Error('RATE_LIMIT'));
    lastCallAt = now; inFlight = true;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key   // 仅内存拼接，不落盘、不打印
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 900,
        stream: false
      }),
      signal: ctrl.signal
    }).then(function (r) {
      if (r.status === 401) throw new Error('BAD_KEY');
      if (r.status === 429) throw new Error('TOO_MANY');
      if (r.status >= 500) throw new Error('SERVER');
      if (!r.ok) throw new Error('HTTP_' + r.status);
      return r.json();
    }).then(function (j) {
      var text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) throw new Error('EMPTY');
      return text.trim();
    }).finally(function () {
      clearTimeout(timer); inFlight = false;
    });
  }

  // 把当前阵容整理成给模型的文字描述（不含任何密钥/隐私）
  function describeComp(mapId, assignments) {
    var D = VCT.data;
    var map = D.mapById[mapId];
    var lines = (assignments || []).map(function (as, i) {
      var a = D.agentById[as.agentId];
      var role = D.ROLES[as.role] ? D.ROLES[as.role].cn : as.role;
      return (i + 1) + '. ' + (a ? a.cn + '(' + a.en + ')' : as.agentId) + ' [' + role + '] — 由 ' + (as.memberName || '待认领') + ' 使用';
    }).join('\n');
    var tmpl = (D.comps[mapId] || [])[0];
    return '地图：' + (map ? map.cn + '（' + map.en + '，' + map.sites + '个点）' : mapId) + '\n' +
      '当前阵容：\n' + lines + '\n' +
      (tmpl ? ('参考经典模板：' + tmpl.name + ' —— ' + tmpl.desc) : '');
  }

  // 友好错误信息
  function friendlyError(e) {
    var m = e && e.message;
    switch (m) {
      case 'NO_KEY': return '尚未配置 DeepSeek API 密钥，请点右上「⚙️ 设置」填写。';
      case 'BUSY': return 'AI 正在处理上一条请求，请稍候。';
      case 'RATE_LIMIT': return '请求太频繁，请隔几秒再试。';
      case 'BAD_KEY': return 'API 密钥无效或已过期，请在设置里更新。';
      case 'TOO_MANY': return 'DeepSeek 返回限流(429)，请稍后再试。';
      case 'SERVER': return 'DeepSeek 服务端错误(5xx)，请稍后再试。';
      case 'EMPTY': return 'AI 未返回内容，请重试。';
      default:
        if (e && e.name === 'AbortError') return '请求超时(30s)，请检查网络后重试。';
        return 'AI 调用失败：' + (m || '未知错误');
    }
  }

  // 阵容分析：给优化建议
  function analyzeComp(mapId, assignments) {
    var sys = '你是资深无畏契约(VALORANT)战术教练。基于给定地图与5人阵容，用简体中文给出精炼实用的优化建议。' +
      '要点：1)阵容位置结构是否均衡(决斗/先锋/控场/哨卫)；2)该地图上的强弱点与潜在缺口；' +
      '3)针对性调整建议(最多3条)。语言简洁，分点作答，不超过300字。';
    return chat([
      { role: 'system', content: sys },
      { role: 'user', content: describeComp(mapId, assignments) + '\n\n请分析这套阵容并给出优化建议。' }
    ]);
  }

  // 练习建议：基于阵容组合推荐要练的英雄
  function practiceAdvice(mapId, assignments) {
    var sys = '你是无畏契约(VALORANT)训练教练。基于给定地图与阵容，用简体中文给出“练习建议”。' +
      '要点：1)这套阵容里哪些英雄/位置最该优先练(说明原因)；2)每位/关键位给出1条具体练习方法(如身法、道具lineup、对枪)；' +
      '分点作答，简洁，不超过300字。';
    return chat([
      { role: 'system', content: sys },
      { role: 'user', content: describeComp(mapId, assignments) + '\n\n请给出针对这套阵容的练习推荐。' }
    ]);
  }

  VCT.ai = {
    hasKey: hasKey,
    getKeyMasked: function () { var k = getKey(); return k ? (k.slice(0, 4) + '••••' + k.slice(-4)) : ''; },
    setKey: setKey,
    analyzeComp: analyzeComp,
    practiceAdvice: practiceAdvice,
    friendlyError: friendlyError
  };
})();
