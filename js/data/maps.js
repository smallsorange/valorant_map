/*
 * maps.js —— 无畏契约当前排位地图池（Season V26 Act 5 / Patch 13.04）
 * -----------------------------------------------------------------
 * 共 7 张排位地图：隐世修所、亚海悬城、霓虹町、日落之城、幽邃地窟、莲华古城、天枢云阙。
 * 数据来源：valorant-api.com（uuid / splash 全景图 / displayIcon 小地图均已核对）。
 *
 * 每张地图字段：
 *   id        内部键
 *   en / cn   英文名 / 官方中文名
 *   sites     炸弹点数量
 *   uuid      valorant-api 素材 uuid（拼接全景图 splash 与小地图 displayIcon）
 *   summary   一句话地图特点
 *   lineups   职业比赛常用道具投掷点位（x/y 为小地图上的百分比坐标 0~100）
 *             每个点位：{ side 攻防, agent 英雄id, ability 技能, x, y, note 说明 }
 *
 * 说明：投掷点位坐标为示意标注（基于小地图相对位置人工标定），用于团队沟通参考，
 * 并非像素级精确的落点。note 描述职业对局中该道具的典型用途。
 */
(function () {
  window.VCT = window.VCT || {};
  var data = (VCT.data = VCT.data || {});

  // 当前排位地图池版本标记（每次赛季轮换只需改这里 + RANKED_POOL）
  data.POOL_VERSION = 'V26 Act 5 · Patch 13.04';
  // 排位地图池：按英文名声明“哪些图在池内”。同步时以此过滤 API 返回的全部地图。
  // 赛季轮换时，改这一个数组即可动态更新地图池（配合 sync.js 自动拉取新图元数据）。
  data.RANKED_POOL = ['Haven', 'Ascent', 'Split', 'Sunset', 'Abyss', 'Lotus', 'Summit'];

  data.maps = [
    {
      id: 'ascent', en: 'Ascent', cn: '亚海悬城', sites: 2,
      uuid: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319',
      summary: '威尼斯风格双点图，超大中路庭院 + 机械门，中路控制决定一切，是职业赛经典图。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 50, y: 72, note: '中路市集侦查箭，开局扫 A 门 / 中路信息。' },
        { side: 'attack',  agent: 'kayo',   ability: '手雷', x: 30, y: 40, note: 'A 点默认烟后 KO 手雷清 A 架点电箱。' },
        { side: 'attack',  agent: 'viper',  ability: '毒墙', x: 68, y: 55, note: 'B 点毒墙切 B main / market 视野配合进攻。' },
        { side: 'defense', agent: 'killjoy', ability: '锁定大招', x: 34, y: 32, note: 'A 点大招锁点，配合 turret 拖延进攻节奏。' },
        { side: 'defense', agent: 'sova',   ability: '猫头鹰无人机', x: 55, y: 60, note: '中路无人机确认进攻方是否走中。' }
      ]
    },
    {
      id: 'haven', en: 'Haven', cn: '隐世修所', sites: 3,
      uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047',
      summary: '首张三点图（A/B/C），空间大、旋转多，考验信息收集与转点纪律。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 26, y: 30, note: 'A 点长廊侦查箭，进攻前清 A 架点信息。' },
        { side: 'attack',  agent: 'breach', ability: '断层地震', x: 50, y: 55, note: '中路 Breach 震荡波配合 C long 进攻。' },
        { side: 'attack',  agent: 'omen',   ability: '球形烟', x: 74, y: 40, note: 'C 点双烟封 C long / C link，标准 C 默认。' },
        { side: 'defense', agent: 'cypher',  ability: '监控相机 / 绊线', x: 72, y: 62, note: 'C 点绊线看 C long，一人守 C 的关键信息位。' },
        { side: 'defense', agent: 'killjoy', ability: '报警机器人', x: 28, y: 66, note: 'A 点 alarmbot 看 A short 侧翼。' }
      ]
    },
    {
      id: 'split', en: 'Split', cn: '霓虹町', sites: 2,
      uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2',
      summary: '东京主题，垂直高度大、通道狭窄，中路 + 双绳梯争夺，控烟组合定义回合。',
      lineups: [
        { side: 'attack',  agent: 'raze',   ability: '皮蛋 Boombot', x: 32, y: 45, note: 'A main 丢皮蛋清 A ramp / heaven 架点。' },
        { side: 'attack',  agent: 'omen',   ability: '球形烟', x: 50, y: 40, note: '中路封 mid / vent 烟，抢中路控制。' },
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 66, y: 60, note: 'B main 侦查箭扫 B site / heaven。' },
        { side: 'defense', agent: 'sage',   ability: '冰墙', x: 34, y: 38, note: 'A 点冰墙封 A main，拖延进攻拿信息。' },
        { side: 'defense', agent: 'cypher',  ability: '绊线', x: 64, y: 66, note: 'B main 绊线，一人守 B 侧翼预警。' }
      ]
    },
    {
      id: 'sunset', en: 'Sunset', cn: '日落之城', sites: 2,
      uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498',
      summary: '洛杉矶主题，结构类似亚海悬城 + 霓虹町，中路 + B main 控制是早期决策关键。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 30, y: 40, note: 'A main 侦查箭扫 A site / elbow。' },
        { side: 'attack',  agent: 'brimstone', ability: '空袭烟', x: 66, y: 45, note: 'B 点 iPad 三烟一键封 B，标准 B 默认执行。' },
        { side: 'attack',  agent: 'kayo',   ability: '手雷', x: 50, y: 62, note: '中路 KO 手雷清 mid 架点，抢中控。' },
        { side: 'defense', agent: 'cypher',  ability: '监控相机', x: 34, y: 35, note: 'A 点 cam 看 A main，退守拿信息。' },
        { side: 'defense', agent: 'viper',  ability: '毒墙', x: 55, y: 58, note: '中路毒墙分割地图，减缓进攻方中路推进。' }
      ]
    },
    {
      id: 'abyss', en: 'Abyss', cn: '幽邃地窟', sites: 2,
      uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f',
      summary: '深渊主题、无边界（可掉出地图）大图，A main util、B long 狙击、中路抢点。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 30, y: 38, note: 'A main 侦查箭清 A site 架点信息。' },
        { side: 'attack',  agent: 'jett',   ability: '烟 + 大招', x: 68, y: 42, note: 'B long Jett 持狙抢点，配合烟进 B。' },
        { side: 'attack',  agent: 'omen',   ability: '球形烟', x: 50, y: 58, note: '中路封烟抢中控，注意边缘不要被推下。' },
        { side: 'defense', agent: 'killjoy', ability: '涡轮 / 大招', x: 34, y: 34, note: 'A 点 util 锁点，边缘位小心被 util 推下。' },
        { side: 'defense', agent: 'cypher',  ability: '绊线', x: 66, y: 64, note: 'B long 绊线预警进攻方 B 推进。' }
      ]
    },
    {
      id: 'lotus', en: 'Lotus', cn: '莲华古城', sites: 3,
      uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9',
      summary: '印度主题第二张三点图（A/B/C），旋转门 + 可破坏门带来多变路线，抢空间与冷静回防是关键。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 26, y: 42, note: 'A main 侦查箭扫 A site，进攻前清点。' },
        { side: 'attack',  agent: 'fade',   ability: 'Prowler 侦查', x: 50, y: 50, note: '中路 Fade 侦查抓 C link / mid 信息。' },
        { side: 'attack',  agent: 'omen',   ability: '球形烟', x: 74, y: 44, note: 'C 点封 C main / C waterfall 双烟默认。' },
        { side: 'defense', agent: 'killjoy', ability: '报警机器人', x: 72, y: 60, note: 'C 点 alarmbot 看 C 侧翼，一人守 C。' },
        { side: 'defense', agent: 'viper',  ability: '毒球 + 毒墙', x: 30, y: 58, note: 'A 点毒 util 拖延进攻，退守拿时间。' }
      ]
    },
    {
      id: 'summit', en: 'Summit', cn: '天枢云阙', sites: 2,
      uuid: '756da597-416b-c0f2-f47b-afbdf28670bc',
      summary: 'Patch 13.00 新图，两点三线 + 可放下的墙体，能在回合中改变视野与转点路线。',
      lineups: [
        { side: 'attack',  agent: 'sova',   ability: '侦查箭', x: 32, y: 44, note: 'A 侧侦查箭清架点，进攻前收集信息。' },
        { side: 'attack',  agent: 'gekko',  ability: '丢丢 Dizzy', x: 50, y: 52, note: '中路 Gekko 致盲开中，配合抢三线控制。' },
        { side: 'attack',  agent: 'omen',   ability: '球形烟', x: 66, y: 46, note: 'B 侧封烟执行，注意可放墙改变的视野。' },
        { side: 'defense', agent: 'cypher',  ability: '绊线 / 相机', x: 34, y: 38, note: 'A 侧 util 预警，退守拿信息。' },
        { side: 'defense', agent: 'deadlock', ability: '声波感应 / 大招', x: 64, y: 62, note: 'B 侧 Deadlock 锁点，配合墙体守点。' }
      ]
    }
  ];

  data.mapById = {};
  data.maps.forEach(function (m) { data.mapById[m.id] = m; });

  // 素材 URL：splash 为全景大图(1.5~5MB，仅详情页大图用)，
  // listViewIcon 为约 60KB 的缩略图(卡片/下拉用)，displayIcon 为小地图
  VCT.assets = VCT.assets || {};
  VCT.assets.mapSplash = function (map) {
    return map.splash || ('https://media.valorant-api.com/maps/' + map.uuid + '/splash.png');
  };
  VCT.assets.mapMinimap = function (map) {
    return map.minimap || ('https://media.valorant-api.com/maps/' + map.uuid + '/displayicon.png');
  };
  // 缩略图：地图卡片/下拉用，约 60KB，比 splash 小 30~90 倍
  VCT.assets.mapThumb = function (map) {
    return map.thumb || ('https://media.valorant-api.com/maps/' + map.uuid + '/listviewicon.png');
  };
})();
