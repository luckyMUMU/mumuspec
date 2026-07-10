import type { SpecFile, Requirement, EnforcementRule } from '../core/types.js';

/** Ponytail 7-level priority ladder */
export const PONYTAIL_LADDER = [
  {
    level: 1,
    question: '这段代码需要存在吗？',
    action: 'YAGNI — 不需要则不写',
    type: 'SHALL NOT',
  },
  {
    level: 2,
    question: '代码库中已有实现吗？',
    action: '复用 — 找到并使用已有代码',
    type: 'SHALL',
  },
  {
    level: 3,
    question: '标准库已经提供了吗？',
    action: '使用标准库 — 不引入外部依赖',
    type: 'SHALL',
  },
  {
    level: 4,
    question: '平台原生特性支持吗？',
    action: '使用平台特性 — 不引入 polyfill',
    type: 'SHALL',
  },
  {
    level: 5,
    question: '已安装的依赖能做吗？',
    action: '使用已有依赖 — 不引入新依赖',
    type: 'SHALL',
  },
  {
    level: 6,
    question: '能一行写完吗？',
    action: '一行代码 — 不过度抽象',
    type: 'SHOULD',
  },
  {
    level: 7,
    question: '以上都不满足',
    action: '最小可工作代码 — 仅写必要的',
    type: 'SHALL',
  },
] as const;

/** Ponytail hard constraints (injected to root spec.md) */
export const PONYTAIL_CONSTRAINTS: Requirement = {
  name: 'Ponytail 基础编码约束',
  shall: [
    '编写新代码前必须检查代码库中是否已有可复用的实现',
    '新代码必须是最小可工作实现（仅写必要的代码）',
    '有意简化必须用 ponytail: 注释标记原因',
  ],
  shallNot: [
    '禁止引入未被请求的抽象层（YAGNI）',
    '禁止在标准库/平台特性已满足需求时引入新依赖',
    '禁止生成未被请求的样板代码（boilerplate）',
    '禁止用复杂方案替代简单方案（boring over clever）',
  ],
  should: [
    '优先删除而非新增代码（deletion over addition）',
    '理解问题后再写代码，而非边写边理解',
    '对复杂请求提出质疑而非盲目实现',
  ],
  enforcement: [
    {
      id: 'PONYTAIL-1',
      description: 'lint rule: detect unnecessary abstraction patterns (YAGNI check)',
      severity: 'WARN',
    },
    {
      id: 'PONYTAIL-2',
      description: 'lint rule: check for unnecessary new dependencies',
      severity: 'ERROR',
    },
    {
      id: 'PONYTAIL-3',
      description: 'lint rule: detect boilerplate code patterns',
      severity: 'WARN',
    },
    {
      id: 'PONYTAIL-4',
      description: 'lint rule: detect overly clever solutions',
      severity: 'WARN',
    },
  ],
};

/** Non-lazy domains (Ponytail does not apply here) */
export const NON_LAZY_DOMAINS = [
  '问题理解',
  '输入验证',
  '错误处理',
  '安全性',
  '可访问性（a11y）',
  '校准与测试',
  '明确请求的功能',
] as const;

/**
 * Inject Ponytail constraints into a root spec file.
 * If the spec already has a Ponytail requirement, it won't be duplicated.
 */
export function injectPonytail(spec: SpecFile): SpecFile {
  // Check if Ponytail constraints are already present
  const hasPonytail = spec.requirements.some(
    (r) => r.name === PONYTAIL_CONSTRAINTS.name,
  );

  if (hasPonytail) {
    return spec;
  }

  return {
    ...spec,
    requirements: [PONYTAIL_CONSTRAINTS, ...spec.requirements],
  };
}

/** Parse ponytail: comment markers from code */
export interface PonytailMarker {
  file: string;
  line: number;
  reason: string;
}

/** Extract ponytail: comment markers from source code */
export function parsePonytailMarkers(content: string, filePath: string): PonytailMarker[] {
  const markers: PonytailMarker[] = [];
  const lines = content.split('\n');

  // Match: // ponytail: <reason> or # ponytail: <reason> or /* ponytail: <reason> */
  const patterns = [
    /\/\/\s*ponytail:\s*(.+)$/i,
    /#\s*ponytail:\s*(.+)$/i,
    /\/\*\s*ponytail:\s*(.+?)\s*\*\//i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        markers.push({
          file: filePath,
          line: i + 1,
          reason: match[1].trim(),
        });
        break;
      }
    }
  }

  return markers;
}

/** Get the Ponytail constraint requirement for spec injection */
export function getPonytailRequirement(): Requirement {
  return { ...PONYTAIL_CONSTRAINTS };
}

/** Get all Ponytail enforcement rules */
export function getPonytailEnforcementRules(): EnforcementRule[] {
  return [...PONYTAIL_CONSTRAINTS.enforcement];
}
