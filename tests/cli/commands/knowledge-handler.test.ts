/**
 * Handler-level tests for knowledge command registration.
 *
 * The knowledge.ts module is a thin barrel that delegates to focused submodules.
 * We verify that registerKnowledgeCommands properly registers all subcommands
 * by mocking each submodule's register function and checking they are called.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockRegisterKnowledgeCrud,
  mockRegisterKnowledgeAnalysis,
  mockRegisterOnboardCommands,
  mockRegisterChatCommand,
  mockRegisterGitCommand,
  mockRegisterKnowledgeScan,
  mockRegisterKnowledgeDoctor,
} = vi.hoisted(() => ({
  mockRegisterKnowledgeCrud: vi.fn(),
  mockRegisterKnowledgeAnalysis: vi.fn(),
  mockRegisterOnboardCommands: vi.fn(),
  mockRegisterChatCommand: vi.fn(),
  mockRegisterGitCommand: vi.fn(),
  mockRegisterKnowledgeScan: vi.fn(),
  mockRegisterKnowledgeDoctor: vi.fn(),
}));

vi.mock('../../../src/cli/commands/knowledge-crud.js', () => ({
  registerKnowledgeCrud: mockRegisterKnowledgeCrud,
}));

vi.mock('../../../src/cli/commands/knowledge-analysis.js', () => ({
  registerKnowledgeAnalysis: mockRegisterKnowledgeAnalysis,
}));

vi.mock('../../../src/cli/commands/knowledge-onboard.js', () => ({
  registerOnboardCommands: mockRegisterOnboardCommands,
}));

vi.mock('../../../src/cli/commands/knowledge-chat.js', () => ({
  registerChatCommand: mockRegisterChatCommand,
}));

vi.mock('../../../src/cli/commands/knowledge-git.js', () => ({
  registerGitCommand: mockRegisterGitCommand,
}));

vi.mock('../../../src/cli/commands/knowledge-scan.js', () => ({
  registerKnowledgeScan: mockRegisterKnowledgeScan,
}));

vi.mock('../../../src/cli/commands/knowledge-doctor.js', () => ({
  registerKnowledgeDoctor: mockRegisterKnowledgeDoctor,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge command registration', () => {
  beforeEach(() => {
    mockRegisterKnowledgeCrud.mockReset();
    mockRegisterKnowledgeAnalysis.mockReset();
    mockRegisterOnboardCommands.mockReset();
    mockRegisterChatCommand.mockReset();
    mockRegisterGitCommand.mockReset();
    mockRegisterKnowledgeScan.mockReset();
    mockRegisterKnowledgeDoctor.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call all submodule register functions', async () => {
    const { registerKnowledgeCommands } = await import('../../../src/cli/commands/knowledge.js');
    const program = new Command();
    registerKnowledgeCommands(program);

    expect(mockRegisterKnowledgeCrud).toHaveBeenCalledTimes(1);
    expect(mockRegisterKnowledgeAnalysis).toHaveBeenCalledTimes(1);
    expect(mockRegisterOnboardCommands).toHaveBeenCalledTimes(1);
    expect(mockRegisterChatCommand).toHaveBeenCalledTimes(1);
    expect(mockRegisterGitCommand).toHaveBeenCalledTimes(1);
    expect(mockRegisterKnowledgeScan).toHaveBeenCalledTimes(1);
    expect(mockRegisterKnowledgeDoctor).toHaveBeenCalledTimes(1);
  });

  it('should pass the knowledge subcommand to CRUD, Scan, and Doctor registers', async () => {
    const { registerKnowledgeCommands } = await import('../../../src/cli/commands/knowledge.js');
    const program = new Command();
    registerKnowledgeCommands(program);

    // CRUD, Scan, Doctor register on the knowledge subcommand (first arg)
    const crudArg = mockRegisterKnowledgeCrud.mock.calls[0][0];
    expect(crudArg).toBeDefined();
    expect(crudArg).toBeInstanceOf(Command);

    const scanArg = mockRegisterKnowledgeScan.mock.calls[0][0];
    expect(scanArg).toBeInstanceOf(Command);

    const doctorArg = mockRegisterKnowledgeDoctor.mock.calls[0][0];
    expect(doctorArg).toBeInstanceOf(Command);
  });

  it('should pass program + knowledge subcommand to Analysis register', async () => {
    const { registerKnowledgeCommands } = await import('../../../src/cli/commands/knowledge.js');
    const program = new Command();
    registerKnowledgeCommands(program);

    // Analysis receives (program, knowledgeCmd)
    const analysisArgs = mockRegisterKnowledgeAnalysis.mock.calls[0];
    expect(analysisArgs).toHaveLength(2);
    expect(analysisArgs[0]).toBeInstanceOf(Command);
    expect(analysisArgs[1]).toBeInstanceOf(Command);
  });

  it('should pass only program to Onboard, Chat, and Git registers', async () => {
    const { registerKnowledgeCommands } = await import('../../../src/cli/commands/knowledge.js');
    const program = new Command();
    registerKnowledgeCommands(program);

    expect(mockRegisterOnboardCommands.mock.calls[0]).toEqual([program]);
    expect(mockRegisterChatCommand.mock.calls[0]).toEqual([program]);
    expect(mockRegisterGitCommand.mock.calls[0]).toEqual([program]);
  });
});
