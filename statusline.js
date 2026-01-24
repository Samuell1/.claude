#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    const data = JSON.parse(input);

    const cwd = data.workspace?.current_dir ?? '';
    const project = path.basename(cwd);

    // Tokens
    const usedTokens = (data.context_window?.total_input_tokens ?? 0) + (data.context_window?.total_output_tokens ?? 0);
    const maxTokens = data.context_window?.context_window_size ?? 200000;
    const pct = Math.floor(data.context_window?.used_percentage ?? 0);

    // Git branch
    let branch = '';
    try {
        branch = execSync(`git -C "${cwd}" branch --show-current`, { encoding: 'utf8', timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {}

    // Format tokens as k
    const fmtK = n => n >= 1000 ? Math.floor(n / 1000) + 'k' : String(n);

    // Progress bar
    const bar = (pct, len = 10) => {
        const filled = Math.round((pct / 100) * len);
        return '█'.repeat(filled) + '░'.repeat(len - filled);
    };

    // Colors
    const orange = '\x1b[38;5;208m';
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';

    let parts = [];

    // Project - branch
    if (branch) {
        parts.push(`${orange}${project}${reset} ${gray}-${reset} ${gray}${branch}${reset}`);
    } else {
        parts.push(`${orange}${project}${reset}`);
    }

    // Tokens with bar
    if (pct > 0) {
        parts.push(`${gray}${fmtK(usedTokens)}/${fmtK(maxTokens)} [${bar(pct)}]${reset}`);
    }

    console.log(parts.join(` ${gray}|${reset} `));
});
