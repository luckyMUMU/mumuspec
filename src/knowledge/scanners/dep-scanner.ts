/**
 * Dependency Scanner — infer design knowledge from package.json / requirements.txt / etc.
 * 
 * Detects framework choices, architectural patterns, and tooling decisions
 * from project dependency manifests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProposedKnowledgePage, DepKnowledgeRule } from '../scan-types.js';

/** Generate ID for proposed knowledge pages (module-scoped counter) */
let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `KS-DEP-${String(idCounter).padStart(4, '0')}`;
}

/**
 * Known dependency -> knowledge inference rules.
 * Each rule defines: when package X is found, propose knowledge Y.
 */
const DEP_RULES: DepKnowledgeRule[] = [
  // === Framework decisions ===
  {
    packagePattern: 'next',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Next.js 作为前端框架',
      contentTemplate: '项目使用 Next.js 框架，意味着选择了 React 生态的服务端渲染 (SSR) / 静态生成 (SSG) 方案。Next.js 提供了基于文件系统的路由、API Routes、和内置的图片优化等功能。',
      tags: ['framework', 'nextjs', 'ssr', 'react'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'nuxt',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Nuxt.js 作为 Vue 全栈框架',
      contentTemplate: '项目使用 Nuxt.js 框架，意味着选择了 Vue 生态的服务端渲染方案。Nuxt 提供了约定式路由、自动导入和模块系统。',
      tags: ['framework', 'nuxt', 'ssr', 'vue'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'vue',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Vue 作为前端框架',
      contentTemplate: '项目使用 Vue 框架。Vue 提供了响应式数据绑定、组件化开发和单文件组件 (SFC) 语法。',
      tags: ['framework', 'vue', 'frontend'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'react',
    propose: {
      type: 'decision',
      titleTemplate: '使用 React 作为前端框架',
      contentTemplate: '项目使用 React 框架。React 提供了基于 hooks 的状态管理、虚拟 DOM 和组件组合模式。',
      tags: ['framework', 'react', 'frontend'],
      confidence: 'high',
    },
  },
  {
    packagePattern: '@nestjs/core',
    propose: {
      type: 'decision',
      titleTemplate: '使用 NestJS 作为后端框架',
      contentTemplate: '项目使用 NestJS 框架，采用了模块化的分层架构（Controller → Service → Repository），内置依赖注入和装饰器模式。',
      tags: ['framework', 'nestjs', 'backend', 'typescript'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'express',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Express 作为 HTTP 服务器框架',
      contentTemplate: '项目使用 Express 作为底层 HTTP 框架。Express 提供了中间件管道模式和路由系统，需要自行选择 ORM、验证等周边库。',
      tags: ['framework', 'express', 'backend', 'http'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'fastify',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Fastify 作为 HTTP 服务器框架',
      contentTemplate: '项目使用 Fastify 框架，选择了高性能、低开销的 HTTP 路由和基于 Schema 的序列化/验证方案。',
      tags: ['framework', 'fastify', 'backend', 'performance'],
      confidence: 'high',
    },
  },
  // === Database / ORM decisions ===
  {
    packagePattern: 'prisma',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Prisma 作为 ORM 工具',
      contentTemplate: '项目使用 Prisma 作为数据库 ORM。Prisma 提供了类型安全的查询构建器、自动迁移生成和数据库 Schema 即代码的工作流。需要注意连接池管理和迁移文件冲突。',
      tags: ['orm', 'prisma', 'database', 'typescript'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'typeorm',
    propose: {
      type: 'decision',
      titleTemplate: '使用 TypeORM 作为 ORM 工具',
      contentTemplate: '项目使用 TypeORM 作为数据库 ORM。TypeORM 支持 Active Record 和 Data Mapper 两种模式，需注意 N+1 查询问题和复杂查询的性能。',
      tags: ['orm', 'typeorm', 'database', 'typescript'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'sequelize',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Sequelize 作为 ORM 工具',
      contentTemplate: '项目使用 Sequelize 作为数据库 ORM。Sequelize 支持多种 SQL 方言，需注意关联查询的性能优化。',
      tags: ['orm', 'sequelize', 'database'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'mongoose',
    propose: {
      type: 'decision',
      titleTemplate: '使用 MongoDB 作为数据库（Mongoose ODM）',
      contentTemplate: '项目使用 MongoDB 作为数据库，通过 Mongoose 进行文档模型和 Schema 定义。选择 MongoDB 意味着选择了灵活 Schema 和水平扩展能力，但需注意事务支持限制。',
      tags: ['database', 'mongodb', 'mongoose', 'nosql'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'redis',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Redis 作为缓存/消息中间件',
      contentTemplate: '项目集成了 Redis，可能用于缓存、会话存储、消息队列或分布式锁。需关注缓存失效策略和内存使用。',
      tags: ['cache', 'redis', 'infrastructure'],
      confidence: 'medium',
    },
  },
  // === Message Queue decisions ===
  {
    packagePattern: 'bullmq',
    propose: {
      type: 'decision',
      titleTemplate: '使用 BullMQ 作为任务队列',
      contentTemplate: '项目使用 BullMQ 作为分布式任务队列。BullMQ 基于 Redis，支持延迟任务、优先级、重试和并发控制。',
      tags: ['queue', 'bullmq', 'async', 'redis'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'kafkajs',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Apache Kafka 作为消息系统',
      contentTemplate: '项目使用 Kafka 作为分布式消息系统，意味着选择了高吞吐量、持久化的消息传递方案。需注意消费者组管理和消息顺序保证。',
      tags: ['queue', 'kafka', 'event-driven', 'microservices'],
      confidence: 'high',
    },
  },
  {
    packagePattern: ['amqplib', 'amqp'],
    propose: {
      type: 'decision',
      titleTemplate: '使用 RabbitMQ 作为消息代理',
      contentTemplate: '项目使用 RabbitMQ 作为 AMQP 消息代理，支持复杂的路由规则和消息确认机制。',
      tags: ['queue', 'rabbitmq', 'amqp', 'microservices'],
      confidence: 'high',
    },
  },
  // === Testing patterns ===
  {
    packagePattern: 'vitest',
    propose: {
      type: 'pattern',
      titleTemplate: '使用 Vitest 作为测试框架',
      contentTemplate: '项目使用 Vitest 作为测试运行器。Vitest 兼容 Jest 测试接口，利用 Vite 的即时热更新实现快速测试反馈。',
      tags: ['testing', 'vitest'],
      confidence: 'medium',
    },
  },
  {
    packagePattern: 'jest',
    propose: {
      type: 'pattern',
      titleTemplate: '使用 Jest 作为测试框架',
      contentTemplate: '项目使用 Jest 作为测试框架。Jest 提供了内置断言库、Mock 功能和代码覆盖率报告。',
      tags: ['testing', 'jest'],
      confidence: 'medium',
    },
  },
  {
    packagePattern: ['cypress', '@cypress/react'],
    propose: {
      type: 'pattern',
      titleTemplate: '使用 Cypress 进行端到端测试',
      contentTemplate: '项目使用 Cypress 进行 E2E 测试。Cypress 提供了真实的浏览器环境测试和实时重载。',
      tags: ['testing', 'cypress', 'e2e'],
      confidence: 'medium',
    },
  },
  // === API documentation ===
  {
    packagePattern: ['swagger-ui-express', '@nestjs/swagger', 'swagger-jsdoc'],
    propose: {
      type: 'pattern',
      titleTemplate: '使用 OpenAPI/Swagger 作为 API 文档规范',
      contentTemplate: '项目使用 Swagger/OpenAPI 规范生成 API 文档，提供了机器可读的接口描述和交互式文档界面。',
      tags: ['docs', 'api', 'openapi', 'swagger'],
      confidence: 'medium',
    },
  },
  // === Monitoring / Observability ===
  {
    packagePattern: ['@sentry/node', '@sentry/react', 'sentry'],
    propose: {
      type: 'decision',
      titleTemplate: '使用 Sentry 进行错误监控',
      contentTemplate: '项目集成 Sentry 进行实时错误追踪和性能监控。Sentry 提供了 Source Map 支持、错误分组和告警功能。',
      tags: ['monitoring', 'sentry', 'observability'],
      confidence: 'medium',
    },
  },
  {
    packagePattern: ['prom-client', 'prometheus'],
    propose: {
      type: 'decision',
      titleTemplate: '使用 Prometheus 作为监控指标收集',
      contentTemplate: '项目集成 Prometheus 客户端进行应用指标暴露，意味着选择了 Pull 模型的监控方案。',
      tags: ['monitoring', 'prometheus', 'metrics'],
      confidence: 'medium',
    },
  },
  // === Authentication / Authorization ===
  {
    packagePattern: 'passport',
    propose: {
      type: 'pattern',
      titleTemplate: '使用 Passport 作为认证中间件',
      contentTemplate: '项目使用 Passport 作为认证中间件，支持多种认证策略（OAuth、JWT、本地认证等）。',
      tags: ['auth', 'passport', 'middleware'],
      confidence: 'medium',
    },
  },
  {
    packagePattern: 'jsonwebtoken',
    propose: {
      type: 'pattern',
      titleTemplate: '使用 JWT 进行令牌认证',
      contentTemplate: '项目使用 JSON Web Token (JWT) 进行无状态认证。JWT 令牌包含签名验证，需关注令牌过期和刷新机制。',
      tags: ['auth', 'jwt', 'token'],
      confidence: 'medium',
    },
  },
  // === GraphQL ===
  {
    packagePattern: 'graphql',
    propose: {
      type: 'decision',
      titleTemplate: '使用 GraphQL 作为 API 查询语言',
      contentTemplate: '项目使用 GraphQL API。GraphQL 提供了强类型 Schema、客户端精确查询和单一端点。需注意 N+1 查询和缓存策略。',
      tags: ['api', 'graphql', 'query-language'],
      confidence: 'high',
    },
  },
  {
    packagePattern: '@apollo/server',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Apollo Server 作为 GraphQL 服务实现',
      contentTemplate: '项目使用 Apollo Server 作为 GraphQL 服务端运行时。Apollo 提供了订阅、联邦和缓存等高级特性。',
      tags: ['api', 'graphql', 'apollo'],
      confidence: 'high',
    },
  },
  // === Python ecosystem ===
  {
    packagePattern: 'django',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Django 作为 Python Web 框架',
      contentTemplate: '项目使用 Django 框架。Django 提供了 ORM、Admin 后台、认证系统等全套功能，遵循 MVT 设计模式。',
      tags: ['framework', 'django', 'backend', 'python'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'djangorestframework',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Django REST Framework 构建 API',
      contentTemplate: '项目使用 Django REST Framework (DRF) 构建 RESTful API，提供了序列化器、视图集和路由器。',
      tags: ['api', 'drf', 'django', 'rest', 'python'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'fastapi',
    propose: {
      type: 'decision',
      titleTemplate: '使用 FastAPI 作为 Python Web 框架',
      contentTemplate: '项目使用 FastAPI 框架。FastAPI 基于 Pydantic 提供类型安全和自动生成 OpenAPI 文档。',
      tags: ['framework', 'fastapi', 'backend', 'python'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'sqlalchemy',
    propose: {
      type: 'decision',
      titleTemplate: '使用 SQLAlchemy 作为 Python ORM',
      contentTemplate: '项目使用 SQLAlchemy 作为数据库 ORM。SQLAlchemy 支持声明式映射和原生 SQL 表达式语言。',
      tags: ['orm', 'sqlalchemy', 'database', 'python'],
      confidence: 'high',
    },
  },
  {
    packagePattern: 'celery',
    propose: {
      type: 'decision',
      titleTemplate: '使用 Celery 作为异步任务队列',
      contentTemplate: '项目使用 Celery 进行异步任务处理和分布式调度。需关注 Broker 选择和任务结果存储。',
      tags: ['queue', 'celery', 'async', 'python'],
      confidence: 'high',
    },
  },
];

/** Package.json structure (minimal) */
interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Parse package.json from a project root */
function parsePackageJson(projectRoot: string): PackageJson | null {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;

  try {
    const content = readFileSync(pkgPath, 'utf8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/** Parse requirements.txt (Python) from a project root */
function parseRequirementsTxt(projectRoot: string): string[] {
  const reqPath = join(projectRoot, 'requirements.txt');
  if (!existsSync(reqPath)) return [];

  try {
    const content = readFileSync(reqPath, 'utf8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/[>=<]/)[0]!.toLowerCase());
  } catch {
    return [];
  }
}

/** Parse pyproject.toml for Python dependencies */
function parsePyprojectToml(projectRoot: string): string[] {
  const tomlPath = join(projectRoot, 'pyproject.toml');
  if (!existsSync(tomlPath)) return [];

  try {
    const content = readFileSync(tomlPath, 'utf8');
    const deps: string[] = [];
    // Simple regex-based extraction (not a full TOML parser)
    const depMatches = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depMatches) {
      const depSection = depMatches[1]!;
      const pkgMatches = depSection.matchAll(/"([^"]+)"/g);
      for (const match of pkgMatches) {
        deps.push(match[1]!.toLowerCase().split(/[>=<]/)[0]!);
      }
    }
    return deps;
  } catch {
    return [];
  }
}

/** Get all package names from the project */
function getPackageNames(projectRoot: string): string[] {
  const names = new Set<string>();

  // Node.js
  const pkg = parsePackageJson(projectRoot);
  if (pkg) {
    const deps = pkg.dependencies ?? {};
    const devDeps = pkg.devDependencies ?? {};
    for (const name of Object.keys(deps)) names.add(name.toLowerCase());
    for (const name of Object.keys(devDeps)) names.add(name.toLowerCase());
  }

  // Python
  for (const name of parseRequirementsTxt(projectRoot)) names.add(name);
  for (const name of parsePyprojectToml(projectRoot)) names.add(name);

  return [...names];
}

/** Match a package name against a rule pattern */
function matchesRule(pkgName: string, pattern: string | string[]): boolean {
  if (Array.isArray(pattern)) {
    return pattern.some((p) => pkgName === p || pkgName.includes(p));
  }
  return pkgName === pattern || pkgName.includes(pattern);
}

/** Scan project dependencies and propose design knowledge */
export function scanDeps(projectRoot: string): ProposedKnowledgePage[] {
  idCounter = 0; // Reset for each scan session
  const packages = getPackageNames(projectRoot);
  const proposed: ProposedKnowledgePage[] = [];
  const matchedRules = new Set<string>();

  for (const rule of DEP_RULES) {
    const patternKey = Array.isArray(rule.packagePattern)
      ? rule.packagePattern.join('|')
      : rule.packagePattern;

    if (matchedRules.has(patternKey)) continue;

    const matched = packages.some((pkg) => matchesRule(pkg, rule.packagePattern));
    if (matched) {
      matchedRules.add(patternKey);
      proposed.push({
        id: generateId(),
        title: rule.propose.titleTemplate,
        type: rule.propose.type,
        scope: '.',
        content: rule.propose.contentTemplate,
        tags: [...rule.propose.tags],
        graph_bindings: [],
        confidence: rule.propose.confidence,
        source: 'deps',
        evidence: `从 package.json / requirements.txt 检测到依赖包: ${patternKey}`,
      });
    }
  }

  return proposed;
}
