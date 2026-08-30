/*
 * agents.js —— 无畏契约全英雄数据（2026 赛季 / Patch 12.05 之后）
 * -----------------------------------------------------------------
 * 数据来源：valorant-api.com 官方社区接口（英雄 uuid / 位置 / 素材均已核对）。
 * 共 29 名可用英雄：决斗者 8、先锋 7、控场者 7、哨卫 7。
 *
 * 每个英雄字段：
 *   id     内部唯一键（小写）
 *   en     英文名（用于匹配职业选手数据）
 *   cn     官方简体中文名
 *   role   位置：duelist / initiator / controller / sentinel
 *   uuid   valorant-api 素材 uuid，用于拼接头像 / 立绘 URL
 *
 * 头像、立绘等图片 URL 统一由 VCT.assets.* 辅助函数根据 uuid 生成，
 * 避免在数据里重复写死一长串地址，方便维护。
 */
(function () {
  window.VCT = window.VCT || {};
  var data = (VCT.data = VCT.data || {});

  // 四个位置的中文名与主题色（UI 里用于分类、着色）
  data.ROLES = {
    duelist:    { key: 'duelist',    cn: '决斗者', en: 'Duelist',    color: '#ff4655', desc: '自给自足的突破手，负责第一个进点、创造空间、拿下击杀。' },
    initiator:  { key: 'initiator',  cn: '先锋',   en: 'Initiator',  color: '#f5a623', desc: '开图、侦查、致盲，为队伍进攻打开缺口并提供信息。' },
    controller: { key: 'controller', cn: '控场者', en: 'Controller', color: '#7b61ff', desc: '用烟雾、墙体切割战场视野，封锁区域、掌控节奏。' },
    sentinel:   { key: 'sentinel',   cn: '哨卫',   en: 'Sentinel',   color: '#2ec4b6', desc: '防守专家，锁点、看后背、用陷阱守住区域。' }
  };
  data.ROLE_ORDER = ['duelist', 'initiator', 'controller', 'sentinel'];

  data.agents = [
    // ===== 决斗者 Duelist (8) =====
    { id: 'jett',    en: 'Jett',    cn: '捷风',   role: 'duelist',    uuid: 'add6443a-41bd-e414-f6ad-e58d267f4e95' },
    { id: 'raze',    en: 'Raze',    cn: '雷兹',   role: 'duelist',    uuid: 'f94c3b30-42be-e959-889c-5aa313dba261' },
    { id: 'reyna',   en: 'Reyna',   cn: '芮娜',   role: 'duelist',    uuid: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc' },
    { id: 'phoenix', en: 'Phoenix', cn: '不死鸟', role: 'duelist',    uuid: 'eb93336a-449b-9c1b-0a54-a891f7921d69' },
    { id: 'yoru',    en: 'Yoru',    cn: '夜露',   role: 'duelist',    uuid: '7f94d92c-4234-0a36-9646-3a87eb8b5c89' },
    { id: 'neon',    en: 'Neon',    cn: '霓虹',   role: 'duelist',    uuid: 'bb2a4828-46eb-8cd1-e765-15848195d751' },
    { id: 'iso',     en: 'Iso',     cn: '壹决',   role: 'duelist',    uuid: '0e38b510-41a8-5780-5e8f-568b2a4f2d6c' },
    { id: 'waylay',  en: 'Waylay',  cn: '幻棱',   role: 'duelist',    uuid: 'df1cb487-4902-002e-5c17-d28e83e78588' },

    // ===== 先锋 Initiator (7) =====
    { id: 'sova',    en: 'Sova',    cn: '猎枭',   role: 'initiator',  uuid: '320b2a48-4d9b-a075-30f1-1f93a9b638fa' },
    { id: 'breach',  en: 'Breach',  cn: '铁臂',   role: 'initiator',  uuid: '5f8d3a7f-467b-97f3-062c-13acf203c006' },
    { id: 'skye',    en: 'Skye',    cn: '斯凯',   role: 'initiator',  uuid: '6f2a04ca-43e0-be17-7f36-b3908627744d' },
    { id: 'kayo',    en: 'KAY/O',   cn: 'K/O',    role: 'initiator',  uuid: '601dbbe7-43ce-be57-2a40-4abd24953621' },
    { id: 'fade',    en: 'Fade',    cn: '黑梦',   role: 'initiator',  uuid: 'dade69b4-4f5a-8528-247b-219e5a1facd6' },
    { id: 'gekko',   en: 'Gekko',   cn: '盖可',   role: 'initiator',  uuid: 'e370fa57-4757-3604-3648-499e1f642d3f' },
    { id: 'tejo',    en: 'Tejo',    cn: '钛狐',   role: 'initiator',  uuid: 'b444168c-4e35-8076-db47-ef9bf368f384' },

    // ===== 控场者 Controller (7) =====
    { id: 'brimstone', en: 'Brimstone', cn: '炼狱', role: 'controller', uuid: '9f0d8ba9-4140-b941-57d3-a7ad57c6b417' },
    { id: 'viper',     en: 'Viper',     cn: '蝰蛇', role: 'controller', uuid: '707eab51-4836-f488-046a-cda6bf494859' },
    { id: 'omen',      en: 'Omen',      cn: '幽影', role: 'controller', uuid: '8e253930-4c05-31dd-1b6c-968525494517' },
    { id: 'astra',     en: 'Astra',     cn: '星礈', role: 'controller', uuid: '41fb69c1-4189-7b37-f117-bcaf1e96f1bf' },
    { id: 'harbor',    en: 'Harbor',    cn: '海神', role: 'controller', uuid: '95b78ed7-4637-86d9-7e41-71ba8c293152' },
    { id: 'clove',     en: 'Clove',     cn: '暮蝶', role: 'controller', uuid: '1dbf2edd-4729-0984-3115-daa5eed44993' },
    { id: 'miks',      en: 'Miks',      cn: '迷核', role: 'controller', uuid: '7c8a4701-4de6-9355-b254-e09bc2a34b72' },

    // ===== 哨卫 Sentinel (7) =====
    { id: 'killjoy',  en: 'Killjoy',  cn: '奇乐', role: 'sentinel', uuid: '1e58de9c-4950-5125-93e9-a0aee9f98746' },
    { id: 'cypher',   en: 'Cypher',   cn: '零',   role: 'sentinel', uuid: '117ed9e3-49f3-6512-3ccf-0cada7e3823b' },
    { id: 'sage',     en: 'Sage',     cn: '贤者', role: 'sentinel', uuid: '569fdd95-4d10-43ab-ca70-79becc718b46' },
    { id: 'chamber',  en: 'Chamber',  cn: '尚勃勒', role: 'sentinel', uuid: '22697a3d-45bf-8dd7-4fec-84a9e28c69d7' },
    { id: 'deadlock', en: 'Deadlock', cn: '钢锁', role: 'sentinel', uuid: 'cc8b64c8-4b25-4ff9-6e7f-37b4da43d235' },
    { id: 'vyse',     en: 'Vyse',     cn: '维斯', role: 'sentinel', uuid: 'efba5359-4016-a1e5-7626-b1ae76895940' },
    { id: 'veto',     en: 'Veto',     cn: '禁灭', role: 'sentinel', uuid: '92eeef5d-43b5-1d4a-8d03-b3927a09034b' }
  ];

  // 便捷索引：按 id、按 en（小写）、按 role 分组
  data.agentById = {};
  data.agentByEn = {};
  data.agentsByRole = { duelist: [], initiator: [], controller: [], sentinel: [] };
  data.agents.forEach(function (a) {
    data.agentById[a.id] = a;
    data.agentByEn[a.en.toLowerCase()] = a;
    data.agentsByRole[a.role].push(a);
  });

  // 素材 URL 生成器（valorant-api 媒体 CDN，稳定按 uuid 拼接）
  VCT.assets = VCT.assets || {};
  // 若英雄对象带 icon/portrait 字段(来自 API 同步)则优先用，否则按 uuid 拼接
  VCT.assets.agentIcon = function (agent) {
    return agent.icon || ('https://media.valorant-api.com/agents/' + agent.uuid + '/displayicon.png');
  };
  VCT.assets.agentPortrait = function (agent) {
    return agent.portrait || ('https://media.valorant-api.com/agents/' + agent.uuid + '/fullportrait.png');
  };
  // 缩略图：卡片网格用较小的 displayIcon（约 410KB）而非 628KB 立绘，降低加载量
  VCT.assets.agentThumb = function (agent) {
    return VCT.assets.agentIcon(agent);
  };
  VCT.assets.agentBackground = function (agent) {
    return 'https://media.valorant-api.com/agents/' + agent.uuid + '/background.png';
  };
})();
