#!/usr/bin/env node
/**
 * MumuSpec CLI — Backward compatibility re-export.
 * Real implementation lives in src/cli/index.ts.
 * Keep this file so the package.json "bin" entry still works.
 */
import { buildProgram } from './cli/index.js';

buildProgram().parse();
