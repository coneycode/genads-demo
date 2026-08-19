// engine/brandGuard.ts —— 品牌白名单校验(严格档出口闸门)
// 用途:LLM 受控散文出文后,当"有广告触发"时扫一遍池外品牌词;
// 若模型偷偷推荐了池外品牌/型号 → 判定不合规 → 由 store 回退预设罐头(fail-closed)。
// 无广告触发时跳过校验,避免误伤信息型回答(如用户自己问"iPhone 和安卓怎么选")。

import type { Advertiser } from "./types";

// 池外常见手机/装修品牌词表(池内没有的)。命中任一即判不合规。
// 维护提示:新增池外品牌直接往这里加;新增池内广告主时确认其 name 不在此列。
const FORBIDDEN_PATTERNS = [
  // 手机
  "iphone", "苹果手机", "app le",
  "redmi", "红米",
  "realme", "真我",
  "oneplus", "一加",
  "huawei", "华为",
  "honor", "荣耀",
  "xiaomi", "小米",
  "meizu", "魅族",
  "nubia", "努比亚",
  "samsung", "三星",
  "sony", "索尼",
  "oppo",
  "vivo" /* vivo 较短易误伤,保留;若误伤可移除 */,
  "nokia", "诺基亚",
  "lenovo", "联想",
  "moto", "摩托",
  "zte", "中兴",
  "smartisan", "锤子", "坚果手机",
  "pixel", "谷歌手机",
  // 装修公司/平台(池内没有的具体品牌)
  "东易日盛", "业之峰", "金螳螂", "名雕", "居然之家", "红星美凯龙", "宜家",
  "齐家", "土巴兔", "住小帮", "爱空间", "被窝",
];

// 构造忽略大小写的单词边界正则:vivo/oppo/zte 等短词用前后非字母边界避免误伤
const FORBIDDEN_BRANDS = new RegExp(
  FORBIDDEN_PATTERNS.map((p) =>
    /[a-z]/.test(p) && p.length <= 5
      ? `(?<![a-z])${escapeReg(p)}(?![a-z])`
      : escapeReg(p)
  ).join("|"),
  "i"
);

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 校验 LLM 回复是否合规。
 * @param text  模型生成的回复正文
 * @param winner 本轮中选广告主(池内)
 * @returns true=合规可展示;false=出现池外品牌,应回退预设罐头
 *
 * 规则:仅当有广告触发(winner != null)时才扫池外品牌——
 * 信息型回答(无广告触发)允许正常提及品牌,不误伤。
 */
export function validateReply(text: string, winner: Advertiser | null): boolean {
  if (!winner) return true; // 无广告触发,不校验
  return !FORBIDDEN_BRANDS.test(text);
}
