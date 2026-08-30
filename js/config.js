/*
 * config.js —— Supabase 云后端配置
 * -----------------------------------------------------------------
 * 已填入你的 Supabase 项目 → 开启“多人实时协作 + 云端编辑日志”。
 * 若想切回本地单机模式，把 url / anonKey 清空即可。
 *
 * 说明：这里用的是 anon public key（JWT），属于**可公开的前端密钥**，
 * 数据访问由数据库的 RLS 行级安全策略控制，可安全提交到仓库 / 部署到 GitHub Pages。
 * ⚠️ 切勿在此填写 service_role 密钥或数据库密码（那些能绕过权限）。
 */
window.VCT = window.VCT || {};
window.VCT.SUPABASE_CONFIG = {
  url: 'https://uufgpdkiceymzzfijbbi.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZmdwZGtpY2V5bXp6ZmlqYmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzQxODcsImV4cCI6MjEwMzY1MDE4N30.ldJNirjWO7d5ZD3LoDJohYMY8m0p8nWsrI5FJTHfvGE'
};
