// i18n 基石——集中导出两份翻译字典与类型，供 LanguageProvider 与消费者使用
// 之所以在这里做 as const，是为了保留 JSON 字面量类型，让消费方 t.xxx.yyy 有 IDE 补全
import zh from '@/messages/zh.json';
import en from '@/messages/en.json';

export const translations = { zh, en } as const;

// 支持的语言集合——目前仅中英双语
export type Language = 'zh' | 'en';

// 以中文字典为翻译树的类型源，保证英文字典结构与之保持一致（编辑时缺 key 会 TS 报错）
export type TranslationTree = typeof zh;
