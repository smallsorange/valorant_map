/*
 * pros.js —— VCT 知名职业选手 → 招牌英雄映射
 * -----------------------------------------------------------------
 * 用途：用户选择擅长英雄后，系统推荐使用该英雄的知名 VCT 职业选手供参考学习。
 *
 * 数据说明：以各赛区广为人知的“招牌英雄”职业选手为主（VCT 2023–2025 赛季公认代表），
 * 每位选手标注赛区与代表战队，方便用户按图索骥去看比赛录像 / 直播学习。
 * 一个英雄可对应多位选手；一位选手也可能精通多个英雄。
 *
 * 字段：name 选手ID、team 代表战队、region 赛区、agents 招牌英雄(英雄id数组)、note 备注
 * 赛区：AMER 美洲 / EMEA 欧非中东 / PACIFIC 太平洋 / CN 中国
 */
(function () {
  window.VCT = window.VCT || {};
  var data = (VCT.data = VCT.data || {});

  data.pros = [
    // —— 决斗者代表 ——
    { name: 'aspas',     team: 'MIBR / LEV',        region: 'AMER',     agents: ['jett', 'raze'],           note: '现代顶级决斗者，Jett/Raze 爆发流代表。' },
    { name: 'TenZ',      team: 'Sentinels',          region: 'AMER',     agents: ['jett'],                    note: '世界级 Jett 招牌，机械瞄准标杆。' },
    { name: 'Derke',     team: 'Fnatic',             region: 'EMEA',     agents: ['jett', 'yoru'],           note: 'EMEA 顶级决斗者，Jett/Yoru 双修。' },
    { name: 'Jinggg',    team: 'Paper Rex',          region: 'PACIFIC',  agents: ['raze'],                    note: '“疯狗雷兹”，Raze 移动与身法代表。' },
    { name: 'ZmjjKK',    team: 'EDG',                region: 'CN',       agents: ['jett', 'reyna'],          note: 'Champions 2024 MVP，激进决斗者。' },
    { name: 'T3xture',   team: 'Gen.G',              region: 'PACIFIC',  agents: ['raze', 'neon', 'jett'],   note: '全能决斗者，Neon 表现尤为亮眼。' },
    { name: 'something',  team: 'Paper Rex',          region: 'PACIFIC',  agents: ['reyna', 'raze'],          note: '暴力 Reyna/Raze 代表。' },
    { name: 'Zyppan',    team: 'Paper Rex',          region: 'PACIFIC',  agents: ['raze'],                    note: 'Raze 稳定输出型决斗者。' },
    { name: 'yay',       team: '—',                  region: 'AMER',     agents: ['jett', 'chamber'],        note: '2022 统治级，Chamber/Jett 名场面。' },
    { name: 'Cryocells', team: 'Sentinels',          region: 'AMER',     agents: ['jett', 'chamber'],        note: '狙击型决斗，Operator 大师。' },
    { name: 'jawgemo',   team: 'Evil Geniuses',      region: 'AMER',     agents: ['iso', 'neon', 'raze'],    note: '爆发型决斗者，Iso/Neon 常客。' },
    { name: 'Zekken',    team: 'Sentinels',          region: 'AMER',     agents: ['iso', 'raze'],            note: 'SEN 决斗者，Iso/Raze 灵活输出。' },

    // —— 先锋代表 ——
    { name: 'Chronicle', team: 'Fnatic',             region: 'EMEA',     agents: ['fade', 'breach', 'gekko'], note: '多冠先锋，Fade/Breach 招牌。' },
    { name: 'crashies',  team: 'NRG',                region: 'AMER',     agents: ['sova', 'kayo'],           note: '顶级信息先锋，Sova/KAY/O 代表。' },
    { name: 'Marved',    team: 'M80 / NRG',          region: 'AMER',     agents: ['sova'],                    note: '（原控场）信息型打法，Sova 老将。' },
    { name: 'BuZz',      team: 'DRX / T1',           region: 'PACIFIC',  agents: ['skye', 'kayo', 'sova'],    note: '太平洋顶级先锋，闪光/信息全能。' },
    { name: 'Mako',      team: 'DRX',                region: 'PACIFIC',  agents: ['breach', 'gekko'],         note: '团队型先锋，Breach 代表。' },
    { name: 'trexx',     team: 'MIBR',               region: 'AMER',     agents: ['sova', 'fade'],            note: '美洲信息先锋。' },
    { name: 'Rossy',     team: 'G2',                 region: 'AMER',     agents: ['fade', 'skye'],            note: '灵活先锋 + 副指挥。' },
    { name: 'RieNs',     team: 'Team Liquid',        region: 'EMEA',     agents: ['fade', 'kayo'],            note: 'EMEA 先锋 + IGL。' },

    // —— 控场者代表 ——
    { name: 'Boaster',   team: 'Fnatic',             region: 'EMEA',     agents: ['brimstone', 'omen'],       note: 'FNC 队长兼控场，Brimstone/Omen。' },
    { name: 'stax',      team: 'T1',                 region: 'PACIFIC',  agents: ['omen', 'astra'],           note: '太平洋控场 + IGL 代表。' },
    { name: 'Shao',      team: 'NAVI',               region: 'EMEA',     agents: ['omen', 'sova'],            note: '灵活控场/先锋 + 指挥。' },
    { name: 'FNS',       team: 'NRG',                region: 'AMER',     agents: ['omen', 'astra', 'brimstone'], note: '美洲控场型 IGL 标杆。' },
    { name: 'Mistic',    team: '—',                  region: 'EMEA',     agents: ['viper', 'harbor'],         note: '毒系控场老将。' },
    { name: 'Rb',        team: 'Gen.G',              region: 'PACIFIC',  agents: ['viper', 'astra'],          note: '太平洋控场，Viper 招牌。' },
    { name: 'Alecks',    team: 'NRG (coach lineage)', region: 'PACIFIC', agents: ['clove'],                   note: 'Clove 灵活控场打法参考。' },
    { name: 'CHICHOO',   team: 'BLG / EDG',          region: 'CN',       agents: ['brimstone', 'omen'],       note: 'CN 控场 + 指挥。' },

    // —— 哨卫代表 ——
    { name: 'Alfajer',   team: 'Fnatic',             region: 'EMEA',     agents: ['killjoy', 'cypher', 'vyse'], note: '世界顶级哨卫，锁点大师。' },
    { name: 'Chronixx',  team: 'Sentinels',          region: 'AMER',     agents: ['cypher', 'killjoy'],       note: '美洲稳健哨卫。' },
    { name: 'zellsis',   team: 'Sentinels',          region: 'AMER',     agents: ['sage', 'gekko'],           note: '激进 Sage/先锋混合打法。' },
    { name: 'Sacy',      team: 'Sentinels',          region: 'AMER',     agents: ['sova', 'killjoy'],         note: '双冠选手，信息 + 哨卫全能。' },
    { name: 'Benkai',    team: 'Paper Rex',          region: 'PACIFIC',  agents: ['killjoy', 'cypher'],       note: 'PRX 队长兼哨卫/指挥。' },
    { name: 'kiNgg',     team: 'EDG',                region: 'CN',       agents: ['killjoy', 'cypher'],       note: 'CN 稳定哨卫。' },
    { name: 'Ap0calypse', team: 'Bilibili Gaming',   region: 'CN',       agents: ['killjoy', 'sage'],         note: 'CN 哨卫 + 副指挥。' },
    { name: 'puru0',     team: 'DRX',                region: 'PACIFIC',  agents: ['chamber', 'cypher'],       note: '太平洋哨卫，Chamber 代表。' }
  ];

  // 建立英雄 -> 选手列表 的索引
  data.prosByAgent = {};
  data.pros.forEach(function (p) {
    p.agents.forEach(function (agentId) {
      (data.prosByAgent[agentId] = data.prosByAgent[agentId] || []).push(p);
    });
  });

  // 赛区中文名
  data.REGION_CN = { AMER: '美洲', EMEA: '欧非中东', PACIFIC: '太平洋', CN: '中国' };
})();
