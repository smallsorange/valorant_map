/*
 * comps.js —— 各地图 VCT 经典强势阵容模板
 * -----------------------------------------------------------------
 * 用途：智能阵容生成的“参考模板”。每张地图给出职业赛区常见的高胜率阵容框架，
 * 生成器会以这些模板为基准，再结合每位团队成员的英雄池做适配分配。
 *
 * 每张地图可有多套模板（meta 常见组合）。模板用“英雄id”列出 5 个位置的典型选择，
 * roles 字段标出该模板的位置结构（用于人数/位置校验）。
 *
 * 说明：这些是社区/职业赛广泛使用的经典框架（VCT 2024–2025 常见双控/单控体系），
 * 作为参考基准，非官方唯一解；生成器允许在同位置内用队员会的英雄替换。
 */
(function () {
  window.VCT = window.VCT || {};
  var data = (VCT.data = VCT.data || {});

  data.comps = {
    ascent: [
      { name: '亚海悬城 · 经典双控体系', agents: ['jett', 'kayo', 'sova', 'omen', 'killjoy'],
        desc: 'Jett 决斗 + KAY/O & Sova 双先锋信息压制 + Omen 控场 + Killjoy 锁 A，是亚海悬城最经典高胜率框架。' }
    ],
    haven: [
      { name: '隐世修所 · 三点信息流', agents: ['jett', 'sova', 'breach', 'omen', 'cypher'],
        desc: 'Sova + Breach 双先锋覆盖三点信息与开团，Omen 灵活烟三点，Cypher 单守一点看后背。' }
    ],
    split: [
      { name: '霓虹町 · 控烟压制体系', agents: ['raze', 'skye', 'omen', 'cypher', 'astra'],
        desc: 'Raze 清狭窄空间 + Skye 先锋开团 + Omen/Astra 双控封中路 + Cypher 守点，契合狭窄垂直地形。' }
    ],
    sunset: [
      { name: '日落之城 · 标准中控体系', agents: ['raze', 'kayo', 'omen', 'brimstone', 'cypher'],
        desc: 'Raze 决斗 + KAY/O 先锋 + Omen & Brimstone 双烟强执行 + Cypher 守点，中路 + B main 控制强。' }
    ],
    abyss: [
      { name: '幽邃地窟 · 狙击控场体系', agents: ['jett', 'sova', 'omen', 'killjoy', 'kayo'],
        desc: 'Jett 持狙 B long + Sova/KAY/O 信息 + Omen 控烟 + Killjoy 锁点，注意边缘 util 对抗。' }
    ],
    lotus: [
      { name: '莲华古城 · 三点毒控流', agents: ['raze', 'fade', 'viper', 'omen', 'killjoy'],
        desc: 'Viper + Omen 双控覆盖三点旋转门，Fade 先锋抓点，Raze 清点，Killjoy 单守一点。' }
    ],
    summit: [
      { name: '天枢云阙 · 三线开团体系', agents: ['jett', 'gekko', 'sova', 'omen', 'deadlock'],
        desc: 'Gekko + Sova 先锋覆盖三线信息，Jett 决斗，Omen 控烟应对可放墙，Deadlock 锁点守墙体路线。' }
    ]
  };
})();
